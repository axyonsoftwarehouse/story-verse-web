/** Ranking semanal e geral de leitura: carregado sob demanda pela home (V3). */
import { GiftIcon } from "../../components/badgeIcons";
import { PersonAvatar } from "../../components/PersonAvatar.tsx";
import { type SupabaseSession } from "../../lib/auth";
import { formatMinutes } from "../../lib/formatMinutes.ts";
import { fetchGiftCatalog, fetchWeeklyGiftCounts, sendGift, type GiftCatalogItem } from "../../lib/gifts";
import { flyEmoji } from "../../lib/motion";
import { PLACE_MEDALS, fetchAlltimeRanking, fetchRanking, fetchRankingProfile, reportReading, setRankingHidden, type RankEntry, type RankingProfile } from "../../lib/ranking";
import { weekStartDate } from "../../lib/readingStats";
import { PersonName } from "../shop/PersonName";
import { useEffect, useState } from "react";

function ordinal(place: number): string {
  return `${place}º`;
}

/** Quanto falta para a semana do ranking acabar (domingo à meia-noite). */
function weekCountdown(now = new Date()): string {
  const end = weekStartDate(now);
  end.setDate(end.getDate() + 7);
  const days = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
  return days <= 1 ? "termina hoje à meia-noite" : `termina em ${days} dias`;
}

function weekRangeLabel(offset: 0 | -1): string {
  const start = weekStartDate();
  start.setDate(start.getDate() + 7 * offset);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");
  return `${fmt(start)} – ${fmt(end)}`;
}

/** Aba do ranking: geral (sem data), esta semana (0) ou a passada (-1). */
type RankingTab = "all" | 0 | -1;

/**
 * Ranking: pódio dos 3 que mais leram, a lista dos demais e a sua posição. Abre no geral, que soma
 * toda a leitura e não zera na virada da semana; o semanal continua com o pódio que ganha diamantes.
 */
export function RankingPage({
  session,
  onClose,
  onOpenShop,
}: {
  session: SupabaseSession;
  onClose: () => void;
  onOpenShop: () => void;
}) {
  const [tab, setTab] = useState<RankingTab>("all");
  const [lists, setLists] = useState<Partial<Record<RankingTab, RankEntry[]>>>({});
  const [profile, setProfile] = useState<RankingProfile | null>(null);
  const [error, setError] = useState("");
  const [savingHidden, setSavingHidden] = useState(false);
  const [giftCatalog, setGiftCatalog] = useState<GiftCatalogItem[]>([]);
  const [giftCounts, setGiftCounts] = useState<Record<string, number>>({});
  const [giftTarget, setGiftTarget] = useState<RankEntry | null>(null);
  const [giftBusy, setGiftBusy] = useState<string | null>(null);
  const [giftNotice, setGiftNotice] = useState("");
  const [giftError, setGiftError] = useState("");

  useEffect(() => {
    let alive = true;
    fetchGiftCatalog(session)
      .then((catalog) => {
        if (alive) setGiftCatalog(catalog);
      })
      .catch(() => {
        // Sem o catálogo, o ranking continua funcionando.
      });
    return () => {
      alive = false;
    };
  }, [session]);

  useEffect(() => {
    let alive = true;
    // No geral, os presentes contados são os desta semana.
    fetchWeeklyGiftCounts(session, tab === "all" ? 0 : tab)
      .then((counts) => {
        if (alive) setGiftCounts(counts);
      })
      .catch(() => {
        if (alive) setGiftCounts({});
      });
    return () => {
      alive = false;
    };
  }, [session, tab]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    if (lists[tab]) return;
    let alive = true;
    setError("");
    // Envia os minutos de agora antes de buscar: a sua posição já sai atualizada.
    const ready = tab !== -1 ? reportReading(session).catch(() => {}) : Promise.resolve();
    void ready
      .then(() =>
        Promise.all([tab === "all" ? fetchAlltimeRanking(session) : fetchRanking(session, tab), fetchRankingProfile(session)]),
      )
      .then(([list, p]) => {
        if (!alive) return;
        setLists((l) => ({ ...l, [tab]: list }));
        setProfile(p);
      })
      .catch((err: unknown) => alive && setError(err instanceof Error ? err.message : "Não foi possível carregar o ranking."));
    return () => {
      alive = false;
    };
    // Recarrega ao trocar de aba ou depois de mudar a visibilidade (que limpa as listas).
  }, [tab, session, lists]);

  async function toggleHidden(hidden: boolean) {
    setSavingHidden(true);
    setError("");
    try {
      await setRankingHidden(session, hidden);
      setProfile((p) => ({ diamonds: p?.diamonds ?? 0, hidden }));
      setLists({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSavingHidden(false);
    }
  }

  function openGift(entry: RankEntry) {
    if (!profile) return;
    setGiftTarget(entry);
    setGiftNotice("");
    setGiftError("");
  }

  async function giveGift(gift: GiftCatalogItem, from: HTMLElement) {
    if (!giftTarget || giftBusy) return;
    // Posição do botão agora: a janela fecha antes do presente sair voando.
    const origin = from.getBoundingClientRect();
    setGiftBusy(gift.id);
    setGiftNotice("");
    setGiftError("");
    try {
      const result = await sendGift(session, giftTarget.user_id, gift.id);
      setProfile((current) => (current ? { ...current, diamonds: result.balance } : current));
      if (!result.duplicate) {
        setGiftCounts((counts) => ({
          ...counts,
          [giftTarget.user_id]: (counts[giftTarget.user_id] ?? 0) + 1,
        }));
      }
      setGiftNotice(
        result.duplicate
          ? "Esse presente já tinha sido registrado."
          : `${gift.icon} enviado! Restam ${result.remaining_today} presentes hoje.`,
      );
      const target = giftTarget.user_id;
      setGiftTarget(null);
      // Com a janela fechada, o presente voa do lugar do botão até o avatar de quem ganhou.
      requestAnimationFrame(() => {
        const box = document.querySelector(`[data-gift-to="${target}"]`);
        flyEmoji(gift.icon, origin, box?.querySelector(".podium-face, .ranking-face") ?? box);
      });
    } catch (err) {
      setGiftError(err instanceof Error ? err.message : "Não foi possível enviar o presente.");
    } finally {
      setGiftBusy(null);
    }
  }

  const list = lists[tab] ?? null;
  const podium = list?.filter((e) => e.place <= 3) ?? [];
  const me = list?.find((e) => e.is_me) ?? null;
  const above = me && me.place > 1 ? list?.find((e) => e.place === me.place - 1) : undefined;
  // O banco manda até 50 do topo; se você está mais abaixo, sua linha vem separada no fim.
  const rest = list?.filter((e) => e.place > 3 && e.place <= 50) ?? [];
  const meOutside = me && me.place > 50 ? me : null;
  // "Atual": o geral e esta semana ainda mudam (dá para presentear); a semana passada já fechou.
  const current = tab !== -1;
  const alltime = tab === "all";

  return (
    <div className="home profile moderation ranking">
      <nav className="home-nav profile-nav">
        <button type="button" className="btn" onClick={onClose}>
          Voltar
        </button>
        {profile ? (
          <button type="button" className="btn ranking-diamonds" onClick={onOpenShop} title="Abrir a loja de diamantes">
            <span aria-hidden="true">💎</span> <strong>{profile.diamonds}</strong>
            <span className="sr-only"> diamantes</span>
          </button>
        ) : null}
      </nav>
      <header className="moderation-head">
        <span className="eyebrow">{tab === "all" ? "Ranking geral · desde o começo" : `Ranking semanal · ${weekRangeLabel(tab)}`}</span>
        <h1>{alltime ? "Quem mais leu até hoje" : current ? "Quem mais leu nesta semana" : "Pódio da semana passada"}</h1>
        {alltime ? (
          <p>Soma todo o seu tempo de leitura e não zera na virada da semana: cada minuto lido fica com você.</p>
        ) : (
          <p>
            Conta o tempo de leitura de segunda a domingo{current ? ` e ${weekCountdown()}` : ""}. Os 3 primeiros ganham
            50, 30 e 20 💎.
          </p>
        )}
      </header>

      <div className="segmented moderation-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={alltime} className={alltime ? "is-on" : ""} onClick={() => setTab("all")}>
          Geral
        </button>
        <button type="button" role="tab" aria-selected={tab === 0} className={tab === 0 ? "is-on" : ""} onClick={() => setTab(0)}>
          Esta semana
        </button>
        <button type="button" role="tab" aria-selected={tab === -1} className={tab === -1 ? "is-on" : ""} onClick={() => setTab(-1)}>
          Semana passada
        </button>
      </div>

      {error ? <p className="auth-error moderation-error" role="alert">{error}</p> : null}

      {list === null && !error ? (
        <div className="page-status">
          <span className="spinner" aria-hidden="true" />
          Carregando ranking…
        </div>
      ) : list ? (
        <>
          <div className={`ranking-me ${me ? "has-place" : ""}`} role="status">
            {profile?.hidden ? (
              <span>Você está escondido do ranking. Ative “Aparecer no ranking” abaixo para concorrer ao pódio.</span>
            ) : me ? (
              <>
                <span className="ranking-me-place" aria-hidden="true">
                  {me.place <= 3 ? PLACE_MEDALS[me.place as 1 | 2 | 3] : ordinal(me.place)}
                </span>
                <span>
                  <strong>
                    Você {current ? "está" : "ficou"} em {ordinal(me.place)} lugar · {formatMinutes(me.minutes)}
                  </strong>
                  {current && above ? (
                    <small>
                      Faltam {formatMinutes(above.minutes - me.minutes + 1)} de leitura para passar{" "}
                      {above.name.split(" ")[0]}.
                    </small>
                  ) : current && me.place === 1 ? (
                    <small>Você está na frente. Continue lendo para manter o ouro!</small>
                  ) : null}
                </span>
              </>
            ) : (
              <span>
                {alltime
                  ? "Você ainda não entrou no ranking. Leia pelo menos 1 minuto para aparecer aqui!"
                  : current
                    ? "Você ainda não entrou no ranking desta semana. Leia pelo menos 1 minuto para aparecer aqui!"
                    : "Você não entrou no ranking da semana passada."}
              </span>
            )}
          </div>

          {list.length === 0 ? (
            <p className="profile-empty moderation-empty">
              {alltime
                ? "Ninguém leu ainda. Que tal ser o primeiro? 📚"
                : current
                  ? "Ninguém leu ainda nesta semana. Que tal ser o primeiro? 📚"
                  : "Ninguém leu na semana passada."}
            </p>
          ) : (
            <ol key={String(tab)} className="podium" aria-label="Pódio">
              {/* Ordem visual de pódio: prata, ouro, bronze. */}
              {[2, 1, 3].map((place) => {
                const e = podium.find((p) => p.place === place);
                return (
                  <li
                    key={place}
                    className={["podium-spot", `is-${place}`, e?.is_me ? "is-me" : "", e ? "" : "is-empty"].filter(Boolean).join(" ")}
                  >
                    {e ? (
                      <>
                        <span className="podium-avatar" data-gift-to={e.user_id}>
                          <PersonAvatar id={e.user_id} name={e.name} avatar={e.avatar} photo={e.photo} className="podium-face" cosmetics={e.cosmetics} />
                          <span className="podium-medal" aria-hidden="true">
                            {PLACE_MEDALS[place as 1 | 2 | 3]}
                          </span>
                        </span>
                        <strong className="podium-name">
                          <PersonName name={e.is_me ? "Você" : e.name} cosmetics={e.cosmetics} />
                        </strong>
                        <span className="podium-minutes">{formatMinutes(e.minutes)}</span>
                        {!e.is_me && profile && current ? (
                          <button
                            type="button"
                            className="podium-gift"
                            onClick={() => openGift(e)}
                            aria-label={`Presentear ${e.name}`}
                            title={`Presentear ${e.name}`}
                          >
                            🎁
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <span className="podium-name is-muted">Vaga aberta</span>
                    )}
                    <span className="podium-block">
                      <span className="sr-only">Lugar </span>
                      {place}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}

          {rest.length > 0 || meOutside ? (
            <ol className="ranking-list" aria-label="Demais leitores">
              {rest.map((e) => (
                <RankingRow
                  key={e.user_id}
                  entry={e}
                  giftsReceived={giftCounts[e.user_id] ?? 0}
                  onGift={current && profile ? openGift : undefined}
                />
              ))}
              {meOutside ? (
                <>
                  <li className="ranking-gap" aria-hidden="true">
                    ⋯
                  </li>
                  <RankingRow
                    entry={meOutside}
                    giftsReceived={giftCounts[meOutside.user_id] ?? 0}
                    onGift={current && profile ? openGift : undefined}
                  />
                </>
              ) : null}
            </ol>
          ) : null}
        </>
      ) : null}

      {giftNotice ? (
        <p className="shop-notice" role="status">
          {giftNotice}
        </p>
      ) : null}
      {giftError ? (
        <p className="auth-error moderation-error" role="alert">
          {giftError}
        </p>
      ) : null}

      {giftTarget ? (
        <section className="gift-panel" aria-label={`Enviar presente para ${giftTarget.name}`}>
          <header className="gift-panel-head">
            <div>
              <strong>Presentear {giftTarget.name.split(" ")[0]}</strong>
              <span>Saldo: {profile?.diamonds ?? 0} 💎</span>
            </div>
            <button type="button" className="btn" onClick={() => setGiftTarget(null)}>
              Fechar
            </button>
          </header>
          {giftCatalog.length === 0 ? (
            <p className="profile-empty">O catálogo de presentes ainda não está disponível.</p>
          ) : (
            <div className="gift-grid">
              {giftCatalog.map((gift) => (
                <button
                  key={gift.id}
                  type="button"
                  className={`gift-option rarity-${gift.rarity}`}
                  onClick={(e) => void giveGift(gift, e.currentTarget)}
                  disabled={giftBusy !== null || (profile?.diamonds ?? 0) < gift.price}
                >
                  <span className="gift-option-icon" aria-hidden="true">
                    <GiftIcon id={gift.id} emoji={gift.icon} size={24} />
                  </span>
                  <strong>{gift.name}</strong>
                  <span>{gift.price} 💎</span>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {profile ? (
        <label className="ranking-visibility">
          <input
            type="checkbox"
            checked={!profile.hidden}
            disabled={savingHidden}
            onChange={(e) => void toggleHidden(!e.target.checked)}
          />
          <span>
            <strong>Aparecer no ranking</strong>
            <small>Outros leitores veem só seu nome, avatar e minutos lidos.</small>
          </span>
        </label>
      ) : null}
    </div>
  );
}

export function RankingRow({
  entry,
  giftsReceived,
  onGift,
}: {
  entry: RankEntry;
  giftsReceived: number;
  onGift?: (entry: RankEntry) => void;
}) {
  return (
    <li className={`ranking-row ${entry.is_me ? "is-me" : ""}`} data-gift-to={entry.user_id}>
      <span className="ranking-place">{ordinal(entry.place)}</span>
      <PersonAvatar id={entry.user_id} name={entry.name} avatar={entry.avatar} photo={entry.photo} className="ranking-face" cosmetics={entry.cosmetics} />
      <span className="ranking-name">
        <PersonName name={entry.is_me ? `${entry.name} (você)` : entry.name} cosmetics={entry.cosmetics} />
      </span>
      <span className="ranking-actions">
        {giftsReceived > 0 ? (
          <span className="gift-count" title="Presentes recebidos nesta semana">
            🎁 {giftsReceived}
          </span>
        ) : null}
        <span className="ranking-minutes">{formatMinutes(entry.minutes)}</span>
        {!entry.is_me && onGift ? (
          <button
            type="button"
            className="gift-chip"
            onClick={() => onGift(entry)}
            aria-label={`Presentear ${entry.name}`}
            title={`Presentear ${entry.name}`}
          >
            Presentear
          </button>
        ) : null}
      </span>
    </li>
  );
}

/** Loja de diamantes e roleta diária: carregadas sob demanda pela home (V3). */
import { Icon } from "../../components/Icon.tsx";
import { RouteLoading, ShopPage } from "../../lazyRoutes";
import { fetchAiQuota, type AiQuota } from "../../lib/ai";
import { buyAiPack, fetchAiPacks, type AiPack } from "../../lib/aiPacks";
import { type SupabaseSession } from "../../lib/auth";
import { SPIN_SEGMENTS, autoFreezeEnabled, diamondEntryLabel, fetchDiamondHistory, fetchSpinStatus, fetchWallet, rescueStreak, setAutoFreezeEnabled, spinDailyWheel, type DiamondEntry, type SpinResult, type Wallet } from "../../lib/diamonds";
import { haptic, prefersReducedMotion, useAnimatedNumber } from "../../lib/motion";
import { streakRescue } from "../../lib/readingStats";
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Desenho da roleta: 8 fatias com os prêmios, a de cima é a sorteada. */
/** Cor de cada faixa de prêmio: âmbar, cobre, esmeralda, safira, rubi e ouro (o prêmio raro). */
const SPIN_TIER: Record<number, string> = { 5: "t5", 10: "t10", 15: "t15", 25: "t25", 50: "t50", 100: "t100" };

/**
 * Desenho da roleta: aro dourado com luzinhas, fatias por faixa de prêmio e o ponteiro que "estala"
 * a cada fatia que passa por ele. `winner`: fatia sorteada, que acende quando a roda para.
 */
function SpinWheel({
  angle,
  spinning,
  winner,
  onStop,
  wrapRef,
}: {
  angle: number;
  spinning: boolean;
  winner: number | null;
  onStop: () => void;
  wrapRef?: (el: HTMLDivElement | null) => void;
}) {
  const n = SPIN_SEGMENTS.length;
  const seg = 360 / n;
  const wheel = useRef<SVGSVGElement>(null);
  const pointer = useRef<HTMLSpanElement>(null);
  const point = (deg: number, r: number) => {
    const rad = (deg * Math.PI) / 180;
    return `${(100 + r * Math.sin(rad)).toFixed(2)} ${(100 - r * Math.cos(rad)).toFixed(2)}`;
  };

  // Enquanto gira: lê o ângulo da roda a cada quadro e faz o ponteiro estalar ao trocar de fatia.
  useEffect(() => {
    if (!spinning || prefersReducedMotion()) return;
    let raf = 0;
    let last = -1;
    const step = () => {
      const el = wheel.current;
      if (el) {
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        const deg = ((Math.atan2(m.b, m.a) * 180) / Math.PI + 360) % 360;
        const under = Math.floor(((360 - deg) % 360) / seg);
        if (under !== last) {
          last = under;
          pointer.current?.animate(
            [{ transform: "rotate(0deg)" }, { transform: "rotate(-22deg)" }, { transform: "rotate(0deg)" }],
            { duration: 140, easing: "ease-out" },
          );
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [spinning, seg]);

  const bulbs = Array.from({ length: 16 }, (_, i) => i * (360 / 16));
  return (
    <div className={`spin-wheel-wrap ${spinning ? "is-spinning" : ""} ${winner !== null && !spinning ? "has-winner" : ""}`} ref={wrapRef}>
      <span className="spin-glow" aria-hidden="true" />
      <span className="spin-pointer" ref={pointer} aria-hidden="true">
        <svg viewBox="0 0 28 36" width="28" height="36">
          <defs>
            <linearGradient id="spin-pointer-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffe6a8" />
              <stop offset="0.5" stopColor="#e4b86a" />
              <stop offset="1" stopColor="#9a6a24" />
            </linearGradient>
          </defs>
          <path d="M14 35 C 8 24, 2 18, 2 11 a12 12 0 0 1 24 0 c0 7 -6 13 -12 24z" fill="url(#spin-pointer-gold)" stroke="#5a3d12" strokeWidth="1.2" />
          <circle cx="14" cy="11" r="4.2" fill="#2a1d0f" />
        </svg>
      </span>
      <svg
        ref={wheel}
        className={`spin-wheel ${spinning ? "is-spinning" : ""}`}
        viewBox="0 0 200 200"
        style={{ transform: `rotate(${angle}deg)` }}
        onTransitionEnd={onStop}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="spin-shade" cx="50%" cy="50%" r="50%">
            <stop offset="0.55" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.38" />
          </radialGradient>
          <linearGradient id="spin-rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffe3a0" />
            <stop offset="0.35" stopColor="#c8933f" />
            <stop offset="0.65" stopColor="#f3cf83" />
            <stop offset="1" stopColor="#8a5b1c" />
          </linearGradient>
          <linearGradient id="spin-jackpot" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f6d27c" />
            <stop offset="1" stopColor="#a8711f" />
          </linearGradient>
          {/* Diamante desenhado (o emoji sai torto e cortado dentro do SVG). */}
          <linearGradient id="spin-gem-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#b8f1ff" />
            <stop offset="1" stopColor="#2aa8e0" />
          </linearGradient>
          <g id="spin-gem">
            <path d="M-5 -1.6 L-2.4 -4.5 L2.4 -4.5 L5 -1.6 L0 4.6 Z" fill="url(#spin-gem-fill)" stroke="#0d4d6e" strokeWidth="0.6" strokeLinejoin="round" />
            <path d="M-5 -1.6 L5 -1.6 M-2.4 -4.5 L-1.2 -1.6 L0 4.6 L1.2 -1.6 L2.4 -4.5" fill="none" stroke="#e8fbff" strokeWidth="0.45" opacity="0.8" />
          </g>
          <radialGradient id="spin-hub" cx="40%" cy="35%" r="70%">
            <stop offset="0" stopColor="#3b2c1b" />
            <stop offset="1" stopColor="#120d08" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="99" fill="url(#spin-rim)" />
        <circle cx="100" cy="100" r="91" fill="#1a130c" />
        {SPIN_SEGMENTS.map((value, i) => {
          const a = i * seg;
          const mid = a + seg / 2;
          return (
            <g key={i} className={`spin-seg ${winner === i ? "is-winner" : ""}`}>
              <path
                d={`M100 100 L${point(a, 89)} A89 89 0 0 1 ${point(a + seg, 89)} Z`}
                className={`spin-slice is-${SPIN_TIER[value] ?? "t5"}`}
              />
              <g transform={`rotate(${mid} 100 100)`}>
                <text x="100" y="33" className={`spin-label ${value >= 50 ? "is-big" : ""}`} textAnchor="middle" dominantBaseline="middle">
                  {value}
                </text>
                <use href="#spin-gem" x="100" y="50" className="spin-gem" />
              </g>
            </g>
          );
        })}
        {SPIN_SEGMENTS.map((_, i) => (
          <line key={i} x1="100" y1="100" x2={point(i * seg, 89).split(" ")[0]} y2={point(i * seg, 89).split(" ")[1]} className="spin-divider" />
        ))}
        <circle cx="100" cy="100" r="89" fill="url(#spin-shade)" pointerEvents="none" />
        {bulbs.map((deg, i) => {
          const [x, y] = point(deg, 95).split(" ");
          return <circle key={deg} cx={x} cy={y} r="2.3" className={`spin-bulb ${i % 2 ? "is-b" : "is-a"}`} />;
        })}
        <circle cx="100" cy="100" r="19" fill="url(#spin-hub)" stroke="url(#spin-rim)" strokeWidth="3" />
        <use href="#spin-gem" transform="translate(100 100) scale(1.7)" className="spin-hub-gem" />
      </svg>
    </div>
  );
}

/** Diamantes que saem de `from` e voam até `to` (ex.: da roleta até o saldo). */
function GemFlight({ from, to, count }: { from: HTMLElement | null; to: HTMLElement | null; count: number }) {
  const [path, setPath] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  useLayoutEffect(() => {
    if (!from || !to || prefersReducedMotion()) return;
    const a = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    const x = a.left + a.width / 2;
    const y = a.top + a.height / 2;
    setPath({ x, y, dx: b.left + b.width / 2 - x, dy: b.top + b.height / 2 - y });
  }, [from, to]);
  if (!path) return null;
  return createPortal(
    <div className="gem-flight" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          style={
            {
              left: path.x,
              top: path.y,
              "--i": i,
              "--dx": `${path.dx}px`,
              "--dy": `${path.dy}px`,
              // Espalha para os lados antes de seguir até o saldo.
              "--spread": `${(i % 2 ? 1 : -1) * (24 + ((i * 29) % 60))}px`,
            } as React.CSSProperties
          }
        >
          💎
        </span>
      ))}
    </div>,
    document.body,
  );
}

/** Roleta diária: um giro por dia, o prêmio vem do banco e a roleta para nele. */
export function DailySpinModal({
  session,
  onClose,
  onWon,
}: {
  session: SupabaseSession;
  onClose: () => void;
  onWon: (result: SpinResult) => void;
}) {
  const [phase, setPhase] = useState<"ready" | "spinning" | "done">("ready");
  const [result, setResult] = useState<SpinResult | null>(null);
  const [angle, setAngle] = useState(0);
  const [error, setError] = useState("");
  const [wheelEl, setWheelEl] = useState<HTMLDivElement | null>(null);
  const [winner, setWinner] = useState<number | null>(null);
  const [balanceEl, setBalanceEl] = useState<HTMLElement | null>(null);
  const celebrate = phase === "done" && !!result?.is_new;
  // O saldo conta a partir do valor de antes do prêmio, enquanto os diamantes chegam.
  const balance = useAnimatedNumber(phase === "done" && result ? result.balance : null, {
    from: celebrate && result ? result.balance - result.prize : undefined,
    delay: 700,
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && phase !== "spinning") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, phase]);

  function finish(r: SpinResult) {
    setPhase("done");
    if (r.is_new) haptic([20, 40, 20]);
    onWon(r);
  }

  async function spin() {
    setPhase("spinning");
    setError("");
    try {
      const r = await spinDailyWheel(session);
      setResult(r);
      const seg = 360 / SPIN_SEGMENTS.length;
      const matches = SPIN_SEGMENTS.flatMap((v, i) => (v === r.prize ? [i] : []));
      const idx = matches[Math.floor(Math.random() * matches.length)] ?? 0;
      setWinner(idx);
      // Para um pouco fora do centro da fatia (como numa roleta de verdade), nunca na divisa.
      const jitter = (Math.random() - 0.5) * seg * 0.55;
      const stop = 360 - (idx * seg + seg / 2 + jitter);
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (!r.is_new || reduced) {
        // Já tinha girado (outro aparelho) ou sem animação: mostra direto o resultado.
        setAngle(stop);
        finish(r);
      } else {
        setAngle(360 * 7 + stop);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível girar a roleta.");
      setPhase("ready");
    }
  }

  return (
    <div className="about-backdrop spin-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && phase !== "spinning" && onClose()}>
      <section className="spin-dialog" role="dialog" aria-modal="true" aria-labelledby="spin-title">
        <button type="button" className="auth-close spin-close" onClick={onClose} disabled={phase === "spinning"} aria-label="Fechar roleta">
          {Icon.close}
        </button>
        <h2 id="spin-title">Roleta diária</h2>
        <p className="spin-sub">
          {phase === "done" && result
            ? result.is_new
              ? "Volte amanhã para girar de novo."
              : "Você já girou hoje. Volte amanhã!"
            : "Um giro por dia: de 5 a 100 💎."}
        </p>

        <SpinWheel
          angle={angle}
          spinning={phase === "spinning"}
          winner={phase === "done" ? winner : null}
          onStop={() => result && phase === "spinning" && finish(result)}
          wrapRef={setWheelEl}
        />
        {celebrate && result ? <GemFlight from={wheelEl} to={balanceEl} count={Math.min(10, Math.max(4, result.prize))} /> : null}

        <div className="spin-foot" aria-live="polite">
          {phase === "done" && result ? (
            <>
              {result.prize >= 50 && result.is_new ? <span className="spin-jackpot-label">Prêmio grande!</span> : null}
              <span className="spin-prize-row">
                <strong className={`spin-prize ${result.prize >= 50 ? "is-jackpot" : ""}`}>+{result.prize}</strong>
                <span className="spin-prize-gem" aria-label="diamantes">
                  💎
                </span>
              </span>
              <span className="spin-balance">
                Saldo:{" "}
                <strong
                  ref={setBalanceEl}
                  className={`count-up ${balance !== null && balance !== result.balance ? "is-counting" : ""}`}
                  aria-hidden="true"
                >
                  {balance ?? result.balance}
                </strong>
                <span className="sr-only">{result.balance}</span>
              </span>
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Boa!
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary spin-go" disabled={phase === "spinning"} onClick={() => void spin()}>
              {phase === "spinning" ? "Girando…" : "Girar"}
            </button>
          )}
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
        </div>
      </section>
    </div>
  );
}

/** Loja: saldo de diamantes, o Salva-ofensiva, como ganhar e o extrato. */
export function DiamondShopPage({
  session,
  onClose,
  onStreakSaved,
}: {
  session: SupabaseSession;
  onClose: () => void;
  onStreakSaved: () => void;
}) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [history, setHistory] = useState<DiamondEntry[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(autoFreezeEnabled);
  const [rescue, setRescue] = useState(streakRescue);
  const [showAll, setShowAll] = useState(false);
  const [spin, setSpin] = useState<{ spun_today: boolean; prize: number | null } | null>(null);
  const [spinOpen, setSpinOpen] = useState(false);
  const [packs, setPacks] = useState<AiPack[]>([]);
  const [quota, setQuota] = useState<AiQuota | null>(null);
  const [buyingPack, setBuyingPack] = useState<string | null>(null);
  const [itemsOpen, setItemsOpen] = useState(false);
  const shownBalance = useAnimatedNumber(wallet ? wallet.balance : null);

  const load = useCallback(() => {
    return Promise.all([
      fetchWallet(session),
      fetchDiamondHistory(session),
      fetchSpinStatus(session).catch(() => null),
      fetchAiPacks(session).catch(() => []),
      fetchAiQuota().catch(() => null),
    ])
      .then(([w, h, sp, catalog, aiQuota]) => {
        setWallet(w);
        setHistory(h);
        setSpin(sp);
        setPacks(catalog);
        setQuota(aiQuota);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Não foi possível carregar seus diamantes."));
  }, [session]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    void load();
  }, [load]);

  async function saveStreak() {
    if (!rescue) return;
    setBusy(true);
    setError("");
    try {
      const r = await rescueStreak(session, rescue);
      setNotice(`Sequência salva: ${r.streak} ${r.streak === 1 ? "dia" : "dias"} 🔥`);
      setRescue(null);
      onStreakSaved();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a sequência.");
    } finally {
      setBusy(false);
    }
  }

  async function buyPack(pack: AiPack) {
    if (buyingPack) return;
    setBuyingPack(pack.id);
    setError("");
    setNotice("");
    try {
      const result = await buyAiPack(session, pack.id);
      setNotice(
        result.duplicate
          ? "Esse pacote já tinha sido registrado."
          : `${pack.messages} mensagens extras adicionadas.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível comprar o pacote.");
    } finally {
      setBuyingPack(null);
    }
  }

  const price = wallet?.freeze_price ?? 0;
  const cost = rescue && rescue.paidDays.length > 0 ? rescue.paidDays.length * price : 0;
  const short = wallet ? Math.max(0, cost - wallet.balance) : 0;
  const shown = showAll ? history : history?.slice(0, 5);

  if (itemsOpen) {
    return (
      <Suspense fallback={<RouteLoading />}>
        <ShopPage
          session={session}
          onBalance={(balance) => setWallet((w) => (w ? { ...w, balance } : w))}
          onClose={() => {
            setItemsOpen(false);
            void load();
          }}
        />
      </Suspense>
    );
  }

  return (
    <div className="home profile shop">
      {spinOpen ? (
        <DailySpinModal
          session={session}
          onClose={() => setSpinOpen(false)}
          onWon={(r) => {
            setSpin({ spun_today: true, prize: r.prize });
            void load();
          }}
        />
      ) : null}
      <nav className="home-nav profile-nav">
        <button type="button" className="btn" onClick={onClose}>
          Voltar
        </button>
      </nav>

      <header className="shop-hero" aria-live="polite">
        <span className="shop-hero-gem" aria-hidden="true">
          💎
        </span>
        <strong className={`count-up ${wallet && shownBalance !== null && shownBalance !== wallet.balance ? "is-counting" : ""}`}>
          {shownBalance ?? "–"}
        </strong>
        <span>diamantes</span>
      </header>

      {error ? <p className="auth-error moderation-error" role="alert">{error}</p> : null}
      {notice ? <p className="shop-notice" role="status">{notice}</p> : null}

      {wallet === null && !error ? (
        <div className="page-status">
          <span className="spinner" aria-hidden="true" />
          Carregando…
        </div>
      ) : wallet ? (
        <>
          <section className="shop-card" aria-label="Loja de itens">
            <div className="shop-card-row">
              <span className="shop-card-icon" aria-hidden="true">
                🛍️
              </span>
              <span className="shop-card-title">
                <strong>Loja de itens</strong>
                <span>Molduras, insígnias, capas e cores de nome</span>
              </span>
              <button type="button" className="btn btn-primary" onClick={() => setItemsOpen(true)}>
                Abrir
              </button>
            </div>
          </section>

          <section className="shop-card" aria-label="Roleta diária">
            <div className="shop-card-row">
              <span className="shop-card-icon" aria-hidden="true">
                🎡
              </span>
              <span className="shop-card-title">
                <strong>Roleta diária</strong>
                <span>{spin?.spun_today ? `Hoje: +${spin.prize} 💎 · volte amanhã` : "Um giro grátis por dia"}</span>
              </span>
              <button type="button" className="btn btn-primary" disabled={!spin || spin.spun_today} onClick={() => setSpinOpen(true)}>
                {spin?.spun_today ? "Amanhã" : "Girar"}
              </button>
            </div>
          </section>

          <section
            className="shop-card"
            aria-label="Salva-ofensiva"
            title={`Mantém a sequência num dia sem leitura. Os escudos grátis são usados antes. Até ${wallet.freezes_per_week} por semana.`}
          >
            <div className="shop-card-row">
              <span className="shop-card-icon" aria-hidden="true">
                🧊
              </span>
              <span className="shop-card-title">
                <strong>Salva-ofensiva</strong>
                <span>{price} 💎 por dia perdido</span>
              </span>
              <span className="shop-chip" aria-label={`${wallet.freezes_this_week} de ${wallet.freezes_per_week} usados nesta semana`}>
                {wallet.freezes_this_week}/{wallet.freezes_per_week} na semana
              </span>
            </div>

            {rescue && cost > 0 ? (
              <div className="shop-rescue">
                <span>
                  🔥 Sequência de <strong>{rescue.streak} {rescue.streak === 1 ? "dia" : "dias"}</strong> quebrou
                </span>
                <button type="button" className="btn btn-primary" disabled={busy || short > 0} onClick={() => void saveStreak()}>
                  {busy ? "Salvando…" : short > 0 ? `Faltam ${short} 💎` : `Salvar · ${cost} 💎`}
                </button>
              </div>
            ) : null}

            <label className="shop-switch">
              <span>Usar automaticamente</span>
              <input
                type="checkbox"
                role="switch"
                checked={auto}
                onChange={(e) => {
                  setAuto(e.target.checked);
                  setAutoFreezeEnabled(e.target.checked);
                }}
              />
            </label>
          </section>

          <section className="shop-card" aria-label="Mensagens extras">
            <div className="shop-card-row">
              <span className="shop-card-icon" aria-hidden="true">
                💬
              </span>
              <span className="shop-card-title">
                <strong>Mensagens extras</strong>
                <span>
                  {quota ? `${quota.credits} disponíveis` : "Carregando…"} · usadas quando a cota gratuita acaba
                </span>
              </span>
            </div>
            {packs.length === 0 ? (
              <p className="profile-empty">Os pacotes de mensagens ainda não estão disponíveis.</p>
            ) : (
              <div className="ai-packs">
                {packs.map((pack) => (
                  <button
                    key={pack.id}
                    type="button"
                    className="ai-pack"
                    disabled={buyingPack !== null || (wallet?.balance ?? 0) < pack.price}
                    onClick={() => void buyPack(pack)}
                  >
                    <strong>{pack.messages} mensagens</strong>
                    <span>{pack.price} 💎</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <h2 className="shop-section-title" id="shop-earn">
            Como ganhar
          </h2>
          <ul className="shop-earn" aria-labelledby="shop-earn">
            <li>
              <span aria-hidden="true">🎡</span>
              <span>Roleta diária</span>
              <strong>até +20</strong>
            </li>
            <li>
              <span aria-hidden="true">📖</span>
              <span>{wallet.goal_minutes} min lidos no dia</span>
              <strong>+{wallet.goal_reward}</strong>
            </li>
            <li>
              <span aria-hidden="true">🏆</span>
              <span>Pódio da semana</span>
              <strong>até +50</strong>
            </li>
          </ul>

          <section className="shop-history" aria-labelledby="shop-history">
            <h2 className="shop-section-title" id="shop-history">
              Extrato
            </h2>
            {shown && shown.length > 0 ? (
              <>
                <ol>
                  {shown.map((e, i) => (
                    <li key={`${e.reason}-${e.ref}-${i}`}>
                      <span>{diamondEntryLabel(e)}</span>
                      <strong className={e.amount > 0 ? "is-in" : "is-out"}>{e.amount > 0 ? `+${e.amount}` : e.amount}</strong>
                    </li>
                  ))}
                </ol>
                {!showAll && history && history.length > 5 ? (
                  <button type="button" className="btn shop-history-more" onClick={() => setShowAll(true)}>
                    Ver tudo
                  </button>
                ) : null}
              </>
            ) : (
              <p className="profile-empty">Nada por aqui ainda. Gire a roleta para ganhar os primeiros!</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

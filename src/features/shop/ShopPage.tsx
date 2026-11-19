import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { SupabaseSession, SupabaseUser } from "../../lib/auth";
import { apiBaseUrl } from "../../lib/backend";
import { fetchWallet } from "../../lib/diamonds";
import {
  buyShopItem,
  equipShopItem,
  fetchMyShopItems,
  fetchShopCatalog,
  newRef,
  MAX_NAME_BADGES,
  shopAssetUrl,
  type Cosmetics,
  type OwnedItem,
  type ShopCategory,
  type ShopItem,
  type ShopTier,
} from "../../lib/shop";
import { PersonFace } from "../groups/GroupParts";
import { PersonName } from "./PersonName";
import "./shop.css";

type Tab = ShopCategory | "mine";

const TABS: { id: Tab; label: string }[] = [
  { id: "frame", label: "Molduras" },
  { id: "badge", label: "Insígnias" },
  { id: "cover", label: "Capas" },
  { id: "name_color", label: "Nomes" },
  { id: "mine", label: "Meus itens" },
];

const CATEGORY_LABEL: Record<ShopCategory, string> = {
  frame: "Moldura",
  badge: "Insígnia",
  cover: "Capa",
  name_color: "Cor de nome",
};

const TIER_LABEL: Record<ShopTier, string> = { common: "Comum", rare: "Raro", epic: "Épico" };

/** O que basta para desenhar um item: vem do catálogo ou da lista de itens da pessoa. */
type Visual = Pick<ShopItem, "id" | "category" | "tier" | "name" | "image_url" | "animated_url" | "colors">;
type Equipped = { frame: string | null; badge: string[]; cover: string | null; name_color: string | null };

const NO_EQUIPPED: Equipped = { frame: null, badge: [], cover: null, name_color: null };

function wearing(equipped: Equipped, category: ShopCategory, id: string): boolean {
  return category === "badge" ? equipped.badge.includes(id) : equipped[category] === id;
}

function meta(user: SupabaseUser, key: string): string | null {
  const v = user.user_metadata?.[key];
  return typeof v === "string" && v ? v : null;
}

function displayName(user: SupabaseUser): string {
  return meta(user, "name")?.trim() || user.email.split("@")[0];
}

/** Só a capa enviada pela própria conta (API do app) ou https; o resto não vira imagem. */
function ownCoverUrl(user: SupabaseUser): string | null {
  const url = meta(user, "cover");
  return url && (url.startsWith("https://") || url.startsWith(`${apiBaseUrl}/`)) ? url : null;
}

function cosmeticsOf(equipped: Equipped, visuals: Map<string, Visual>): Cosmetics {
  const frame = equipped.frame ? visuals.get(equipped.frame) : undefined;
  const badges = equipped.badge
    .map((id) => visuals.get(id))
    .filter((item): item is Visual => Boolean(item))
    .slice(0, MAX_NAME_BADGES);
  const color = equipped.name_color ? visuals.get(equipped.name_color) : undefined;
  return {
    frame: frame ? { image: frame.image_url, animated: frame.animated_url, tier: frame.tier } : null,
    badge: badges[0] ? { image: badges[0].image_url, name: badges[0].name } : null,
    badges: badges.map((item) => ({ image: item.image_url, name: item.name })),
    name_color: color?.colors ?? null,
  };
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function untilLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `Até ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
}

/** Loja de itens de perfil: molduras, insígnias, capas e cores de nome, com prévia na própria conta. */
export function ShopPage({
  session,
  onBalance,
  onClose,
}: {
  session: SupabaseSession;
  onBalance?: (n: number) => void;
  onClose?: () => void;
}) {
  const user = session.user;
  const name = displayName(user);
  const [tab, setTab] = useState<Tab>("frame");
  const [catalog, setCatalog] = useState<ShopItem[] | null>(null);
  const [mine, setMine] = useState<OwnedItem[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [equipped, setEquipped] = useState<Equipped>(NO_EQUIPPED);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ item: ShopItem; ref: string } | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState("");
  const [bought, setBought] = useState<ShopItem | null>(null);
  const [equipping, setEquipping] = useState<ShopCategory | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const buyingRef = useRef(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(() => {
    return Promise.all([fetchShopCatalog(session), fetchMyShopItems(session), fetchWallet(session)])
      .then(([items, owned, wallet]) => {
        setCatalog(items);
        setMine(owned);
        setBalance(wallet.balance);
        const next: Equipped = { frame: null, badge: [], cover: null, name_color: null };
        const mark = (category: ShopCategory, id: string) => {
          if (category === "badge") {
            if (!next.badge.includes(id) && next.badge.length < MAX_NAME_BADGES) next.badge.push(id);
          } else {
            next[category] = id;
          }
        };
        for (const o of owned) if (o.equipped) mark(o.category, o.item_id);
        for (const i of items) if (i.equipped) mark(i.category, i.id);
        setEquipped(next);
      })
      .catch((err: unknown) => setError(errorText(err, "Não foi possível abrir a loja.")));
  }, [session]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    void load();
  }, [load]);

  useEffect(() => {
    if (!pending && !bought) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || buying) return;
      if (pending) setPending(null);
      else setBought(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, bought, buying]);

  const visuals = useMemo(() => {
    const map = new Map<string, Visual>();
    for (const o of mine) map.set(o.item_id, { ...o, id: o.item_id });
    for (const i of catalog ?? []) map.set(i.id, i);
    return map;
  }, [catalog, mine]);

  const owned = useMemo(() => {
    const set = new Set(mine.map((o) => o.item_id));
    for (const i of catalog ?? []) if (i.owned) set.add(i.id);
    return set;
  }, [catalog, mine]);

  const preview = previewId ? visuals.get(previewId) : undefined;
  const previewEquipped: Equipped = !preview
    ? equipped
    : preview.category === "badge"
      ? {
          ...equipped,
          badge: equipped.badge.includes(preview.id)
            ? equipped.badge
            : [...equipped.badge, preview.id].slice(0, MAX_NAME_BADGES),
        }
      : { ...equipped, [preview.category]: preview.id };
  const previewCosmetics = cosmeticsOf(previewEquipped, visuals);
  const coverItem = previewEquipped.cover ? visuals.get(previewEquipped.cover) : undefined;
  const coverSrc = coverItem ? shopAssetUrl(coverItem.image_url) : ownCoverUrl(user);

  function openBuy(item: ShopItem) {
    setPreviewId(item.id);
    setBought(null);
    setBuyError("");
    setNotice("");
    setPending({ item, ref: newRef() });
  }

  function markOwned(item: ShopItem) {
    setCatalog((list) => (list ?? []).map((i) => (i.id === item.id ? { ...i, owned: true } : i)));
    setMine((list) =>
      list.some((o) => o.item_id === item.id)
        ? list
        : [
            ...list,
            {
              item_id: item.id,
              category: item.category,
              tier: item.tier,
              name: item.name,
              image_url: item.image_url,
              animated_url: item.animated_url,
              colors: item.colors,
              equipped: false,
              price_paid: item.price,
              bought_at: new Date().toISOString(),
            },
          ],
    );
  }

  async function confirmBuy() {
    if (!pending || buyingRef.current) return;
    buyingRef.current = true;
    setBuying(true);
    setBuyError("");
    const { item, ref } = pending;
    try {
      const result = await buyShopItem(session, item.id, ref);
      setBalance(result.balance);
      onBalance?.(result.balance);
      markOwned(item);
      setPending(null);
      setBought(item);
    } catch (err) {
      const message = errorText(err, "Não foi possível comprar o item.");
      if (message.includes("já tem este item")) {
        markOwned(item);
        setPending(null);
        setNotice("Você já tem este item.");
      } else {
        // Mesmo `ref` na nova tentativa: se a compra chegou ao servidor, não cobra de novo.
        setBuyError(message);
      }
    } finally {
      buyingRef.current = false;
      setBuying(false);
    }
  }

  async function equip(category: ShopCategory, itemId: string | null) {
    if (equipping) return;
    setEquipping(category);
    setError("");
    setNotice("");
    const hadBadge = category === "badge" && itemId !== null && equipped.badge.includes(itemId);
    try {
      await equipShopItem(session, category, itemId);
      setEquipped((e) => {
        if (category !== "badge") return { ...e, [category]: itemId };
        if (!itemId) return { ...e, badge: [] };
        if (e.badge.includes(itemId)) return { ...e, badge: e.badge.filter((id) => id !== itemId) };
        return { ...e, badge: [...e.badge, itemId].slice(0, MAX_NAME_BADGES) };
      });
      setMine((list) =>
        list.map((o) => {
          if (o.category !== category) return o;
          if (category === "badge") {
            if (!itemId) return { ...o, equipped: false };
            return o.item_id === itemId ? { ...o, equipped: !o.equipped } : o;
          }
          return { ...o, equipped: o.item_id === itemId };
        }),
      );
      setCatalog((list) =>
        (list ?? []).map((i) => {
          if (i.category !== category) return i;
          if (category === "badge") {
            if (!itemId) return { ...i, equipped: false };
            return i.id === itemId ? { ...i, equipped: !i.equipped } : i;
          }
          return { ...i, equipped: i.id === itemId };
        }),
      );
      if (itemId && previewId === itemId) setPreviewId(null);
      setNotice(
        category === "badge" && itemId && hadBadge
          ? `${visuals.get(itemId)?.name ?? "Insígnia"} retirada.`
          : itemId
            ? `${visuals.get(itemId)?.name ?? "Item"} equipado.`
            : category === "cover"
              ? "Seu perfil voltou a usar sua foto de capa."
              : `${CATEGORY_LABEL[category]} retirada.`,
      );
    } catch (err) {
      setError(errorText(err, "Não foi possível equipar o item."));
    } finally {
      setEquipping(null);
    }
  }

  const items = tab === "mine" ? [] : (catalog ?? []).filter((i) => i.category === tab);

  return (
    <div className="home profile store">
      <nav className="home-nav profile-nav">
        {onClose ? (
          <button type="button" className="btn" onClick={onClose}>
            Voltar
          </button>
        ) : (
          <span />
        )}
        <p className="store-balance" role="status" aria-label={`Saldo: ${balance ?? "–"} diamantes`}>
          <span aria-hidden="true">💎</span> {balance ?? "–"}
        </p>
      </nav>

      <header className="store-head">
        <h1>Loja de itens</h1>
        <p>Enfeites para o seu perfil. Toque num item para ver como fica em você.</p>
      </header>

      <div className="store-tabs" role="tablist" aria-label="Tipos de item">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`store-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="store-panel"
            className={`store-tab ${tab === t.id ? "is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="auth-error moderation-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="shop-notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="store-layout">
        <aside key={`${tab}-${previewId ?? "hoje"}`} className="store-preview" aria-label="Prévia no seu perfil">
          {tab === "cover" || (preview?.category === "cover" && tab === "mine") ? (
            <div className="store-banner">
              {coverSrc ? <img src={coverSrc} alt="" decoding="async" referrerPolicy="no-referrer" /> : null}
              <span className="store-banner-face">
                <PersonFace id={user.id} name={name} avatar={meta(user, "avatar")} photo={meta(user, "photo")} size="lg" cosmetics={previewCosmetics} animate />
              </span>
            </div>
          ) : (
            <div className="store-preview-face">
              <PersonFace id={user.id} name={name} avatar={meta(user, "avatar")} photo={meta(user, "photo")} size="lg" cosmetics={previewCosmetics} animate />
            </div>
          )}
          <PersonName className="store-preview-name" name={name} cosmetics={previewCosmetics} />
          <p className="store-preview-hint">{preview ? `Prévia: ${preview.name}` : "Como você aparece hoje"}</p>
          {preview ? (
            <button type="button" className="inline-link" onClick={() => setPreviewId(null)}>
              Limpar prévia
            </button>
          ) : null}
        </aside>

        <section className="store-main">
          <div key={tab} id="store-panel" className="store-panel" role="tabpanel" aria-labelledby={`store-tab-${tab}`}>
            {catalog === null && !error ? (
              <div className="page-status">
                <span className="spinner" aria-hidden="true" />
                Carregando…
              </div>
            ) : tab === "mine" ? (
              <MyItems
                mine={mine}
                equipped={equipped}
                equipping={equipping}
                previewId={previewId}
                user={user}
                name={name}
                onPreview={setPreviewId}
                onEquip={(c, id) => void equip(c, id)}
              />
            ) : (
              <>
                {tab === "badge" ? (
                  <p className="store-own-cover">Até 4 insígnias ficam ao lado do seu nome. Toque em Equipar de novo para tirar uma.</p>
                ) : null}
                {tab === "cover" ? (
                  <div className="store-own-cover">
                    <span>
                      <strong>Sua foto de capa</strong>
                      <span>{equipped.cover ? "Volte para a capa que você enviou." : "Em uso no seu perfil."}</span>
                    </span>
                    <button
                      type="button"
                      className="btn"
                      disabled={!equipped.cover || equipping !== null}
                      onClick={() => void equip("cover", null)}
                    >
                      Usar minha foto de capa
                    </button>
                  </div>
                ) : null}
                {items.length === 0 ? (
                  <p className="profile-empty">Nenhum item deste tipo à venda por enquanto.</p>
                ) : (
                  <ul className="store-grid">
                    {items.map((item, index) => (
                      <ItemCard
                        key={item.id}
                        index={index}
                        item={item}
                        user={user}
                        name={name}
                        owned={owned.has(item.id)}
                        isEquipped={wearing(equipped, item.category, item.id)}
                        badgeFull={item.category === "badge" && equipped.badge.length >= MAX_NAME_BADGES}
                        balance={balance ?? 0}
                        previewing={previewId === item.id}
                        busy={equipping !== null || pending !== null}
                        onPreview={() => setPreviewId(previewId === item.id ? null : item.id)}
                        onBuy={() => openBuy(item)}
                        onEquip={(id) => void equip(item.category, id)}
                      />
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {pending ? (
        <div
          className="store-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !buying) setPending(null);
          }}
        >
          <div className="store-modal" role="dialog" aria-modal="true" aria-labelledby="store-modal-title">
            <ItemThumb item={pending.item} user={user} name={name} />
            <h2 id="store-modal-title">Comprar {pending.item.name}?</h2>
            <p>
              Custa {pending.item.price} diamantes. Seu saldo fica em {Math.max(0, (balance ?? 0) - pending.item.price)}.
            </p>
            {buyError ? (
              <p className="store-modal-error" role="alert">
                {buyError}
              </p>
            ) : null}
            <div className="store-modal-actions">
              <button type="button" className="btn" disabled={buying} onClick={() => setPending(null)}>
                Cancelar
              </button>
              <button ref={confirmRef} type="button" className="btn btn-primary" aria-busy={buying} onClick={() => void confirmBuy()}>
                {buying ? "Comprando…" : buyError ? "Tentar de novo" : "Confirmar compra"}
              </button>
            </div>
          </div>
        </div>
      ) : bought ? (
        <div
          className="store-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setBought(null);
          }}
        >
          <div className="store-modal" role="dialog" aria-modal="true" aria-labelledby="store-modal-title">
            <ItemThumb item={bought} user={user} name={name} />
            <h2 id="store-modal-title">Equipar agora?</h2>
            <p>{bought.name} já é seu. Dá para usar no perfil agora.</p>
            <div className="store-modal-actions">
              <button type="button" className="btn" onClick={() => setBought(null)}>
                Agora não
              </button>
              <button
                ref={confirmRef}
                type="button"
                className="btn btn-primary"
                disabled={equipping !== null}
                onClick={() => {
                  const item = bought;
                  setBought(null);
                  void equip(item.category, item.id);
                }}
              >
                Equipar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Miniatura do item: a moldura e a cor de nome já aparecem aplicadas na própria conta. */
function ItemThumb({ item, user, name }: { item: Visual; user: SupabaseUser; name: string }) {
  if (item.category === "frame") {
    const cosmetics: Cosmetics = { frame: { image: item.image_url, animated: item.animated_url, tier: item.tier }, badge: null, name_color: null };
    return (
      <span className="store-thumb store-thumb-frame">
        <PersonFace id={user.id} name={name} avatar={meta(user, "avatar")} photo={meta(user, "photo")} size="lg" cosmetics={cosmetics} />
      </span>
    );
  }
  if (item.category === "name_color") {
    return (
      <span className="store-thumb store-thumb-name">
        <PersonName name={name} cosmetics={{ frame: null, badge: null, name_color: item.colors }} />
      </span>
    );
  }
  const src = shopAssetUrl(item.image_url);
  return (
    <span className={`store-thumb store-thumb-${item.category}`}>
      {src ? <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : null}
    </span>
  );
}

function TierLabel({ tier }: { tier: ShopTier }) {
  return <span className={`store-tier store-tier-${tier}`}>{TIER_LABEL[tier]}</span>;
}

function ItemCard({
  item,
  index = 0,
  user,
  name,
  owned,
  isEquipped,
  badgeFull = false,
  balance,
  previewing,
  busy,
  onPreview,
  onBuy,
  onEquip,
}: {
  item: ShopItem;
  index?: number;
  user: SupabaseUser;
  name: string;
  owned: boolean;
  isEquipped: boolean;
  /** As quatro vagas ao lado do nome já estão ocupadas. */
  badgeFull?: boolean;
  balance: number;
  previewing: boolean;
  busy: boolean;
  onPreview: () => void;
  onBuy: () => void;
  onEquip: (id: string | null) => void;
}) {
  const soldOut = !owned && item.remaining === 0;
  const short = Math.max(0, item.price - balance);
  const until = untilLabel(item.available_until);
  return (
    <li className={`store-card store-card-${item.tier} ${previewing ? "is-previewing" : ""}`} style={{ "--i": index } as CSSProperties}>
      <button type="button" className="store-card-preview" aria-pressed={previewing} aria-label={`Prévia: ${item.name}`} onClick={onPreview}>
        <ItemThumb item={item} user={user} name={name} />
      </button>
      <div className="store-card-body">
        <div className="store-card-top">
          <strong>{item.name}</strong>
          <TierLabel tier={item.tier} />
        </div>
        {item.description ? <p>{item.description}</p> : null}
        {until || (item.remaining !== null && item.remaining > 0) ? (
          <p className="store-card-limit">
            {[until, item.remaining !== null && item.remaining > 0 ? `Restam ${item.remaining}` : null].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>
      <div className="store-card-actions">
        {owned ? (
          <>
            <span className="shop-chip store-owned">Seu</span>
            <button
              type="button"
              className={`btn ${isEquipped ? "" : "btn-primary"}`}
              disabled={busy || (badgeFull && !isEquipped)}
              onClick={() => onEquip(isEquipped && item.category !== "badge" ? null : item.id)}
            >
              {isEquipped ? "Tirar" : badgeFull ? "4 no nome" : "Equipar"}
            </button>
          </>
        ) : soldOut ? (
          <button type="button" className="btn" disabled>
            Esgotado
          </button>
        ) : short > 0 ? (
          <button type="button" className="btn" disabled>
            Faltam {short} 💎
          </button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onBuy}>
            Comprar · {item.price} 💎
          </button>
        )}
      </div>
    </li>
  );
}

function MyItems({
  mine,
  equipped,
  equipping,
  previewId,
  user,
  name,
  onPreview,
  onEquip,
}: {
  mine: OwnedItem[];
  equipped: Equipped;
  equipping: ShopCategory | null;
  previewId: string | null;
  user: SupabaseUser;
  name: string;
  onPreview: (id: string | null) => void;
  onEquip: (category: ShopCategory, id: string | null) => void;
}) {
  if (mine.length === 0) {
    return <p className="profile-empty">Você ainda não tem itens. Escolha um nas outras abas!</p>;
  }
  return (
    <ul className="store-mine">
      {mine.map((o) => {
        const on = wearing(equipped, o.category, o.item_id);
        const full = o.category === "badge" && !on && equipped.badge.length >= MAX_NAME_BADGES;
        return (
          <li key={o.item_id} className={previewId === o.item_id ? "is-previewing" : ""}>
            <button
              type="button"
              className="store-card-preview"
              aria-pressed={previewId === o.item_id}
              aria-label={`Prévia: ${o.name}`}
              onClick={() => onPreview(previewId === o.item_id ? null : o.item_id)}
            >
              <ItemThumb item={{ ...o, id: o.item_id }} user={user} name={name} />
            </button>
            <span className="store-mine-text">
              <strong>{o.name}</strong>
              <span>
                {CATEGORY_LABEL[o.category]} · <TierLabel tier={o.tier} />
                {on ? " · Em uso" : ""}
              </span>
            </span>
            <button
              type="button"
              className={`btn ${on ? "" : "btn-primary"}`}
              disabled={equipping !== null || full}
              onClick={() => onEquip(o.category, on && o.category !== "badge" ? null : o.item_id)}
            >
              {on ? "Tirar" : full ? "4 no nome" : "Equipar"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

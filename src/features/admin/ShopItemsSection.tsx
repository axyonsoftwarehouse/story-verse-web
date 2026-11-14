import { useEffect, useState } from "react";
import { useConfirm } from "../../components/ConfirmDialog";
import type { SupabaseSession } from "../../lib/auth";
import {
  SHOP_CATEGORY_LABEL,
  SHOP_STATUS_LABEL,
  SHOP_TIER_LABEL,
  deleteShopItem,
  listShopItems,
  toShopItemInput,
  updateShopItem,
  type AdminShopItem,
  type ShopStatus,
} from "../../lib/adminShop";
import { nameColorStyle, shopAssetUrl, type ShopCategory } from "../../lib/shop";
import { ShopItemForm } from "./ShopItemForm";

const STATUS_TONE: Record<ShopStatus, string> = {
  draft: "is-pending",
  on_sale: "is-approved",
  off_sale: "is-hidden",
};

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function ownersLabel(owners: number): string {
  if (owners === 0) return "Sem donos";
  return owners === 1 ? "1 dono" : `${owners} donos`;
}

function ItemThumb({ item }: { item: AdminShopItem }) {
  if (item.category === "name_color") {
    return (
      <span className="shop-row-thumb is-name">
        <span style={nameColorStyle(item.colors)}>Aa</span>
      </span>
    );
  }
  const src = item.image_url ? shopAssetUrl(item.image_url) : "";
  return (
    <span className={`shop-row-thumb is-${item.category}`}>
      {src ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="muted">Sem imagem</span>}
    </span>
  );
}

/** Loja de itens de perfil no painel: lista com filtros, criar, editar, pôr/tirar de venda, apagar. */
export function ShopItemsSection({ session }: { session: SupabaseSession }) {
  const [category, setCategory] = useState<ShopCategory | "">("");
  const [status, setStatus] = useState<ShopStatus | "">("");
  const [items, setItems] = useState<AdminShopItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminShopItem | "new" | null>(null);
  const [version, setVersion] = useState(0);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    listShopItems(session, { category, status })
      .then((rows) => {
        if (alive) setItems(rows);
      })
      .catch((err) => {
        if (!alive) return;
        setError(message(err, "Não foi possível carregar os itens da loja."));
        setItems([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [session, category, status, version]);

  async function setItemStatus(item: AdminShopItem, next: ShopStatus) {
    setBusyId(item.id);
    setError("");
    setNotice("");
    try {
      await updateShopItem(session, item.id, { ...toShopItemInput(item), status: next });
      setNotice(next === "on_sale" ? `${item.name} está à venda.` : `${item.name} saiu da venda.`);
      setVersion((value) => value + 1);
    } catch (err) {
      setError(message(err, "Não foi possível mudar o estado do item."));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: AdminShopItem) {
    const ok = await confirm({
      title: `Apagar ${item.name}?`,
      message: "O item some do painel e da loja. Não dá para desfazer.",
      confirmLabel: "Apagar",
      danger: true,
    });
    if (!ok) return;
    setBusyId(item.id);
    setError("");
    setNotice("");
    try {
      await deleteShopItem(session, item.id);
      setNotice(`${item.name} foi apagado.`);
      setVersion((value) => value + 1);
    } catch (err) {
      setError(message(err, "Não foi possível apagar o item."));
    } finally {
      setBusyId(null);
    }
  }

  const filtered = Boolean(category || status);

  return (
    <section className="shelf admin-shop">
      <div className="shelf-head">
        <div>
          <h2>Loja</h2>
          <p className="muted">Molduras, insígnias, capas e nomes coloridos vendidos por diamantes.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
          Novo item
        </button>
      </div>

      <div className="admin-filters">
        <label>
          Tipo
          <select value={category} onChange={(event) => setCategory(event.target.value as ShopCategory | "")}>
            <option value="">Todos</option>
            {(Object.keys(SHOP_CATEGORY_LABEL) as ShopCategory[]).map((value) => (
              <option key={value} value={value}>
                {SHOP_CATEGORY_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estado
          <select value={status} onChange={(event) => setStatus(event.target.value as ShopStatus | "")}>
            <option value="">Todos</option>
            {(Object.keys(SHOP_STATUS_LABEL) as ShopStatus[]).map((value) => (
              <option key={value} value={value}>
                {SHOP_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="muted" role="status">
          {notice}
        </p>
      ) : null}

      {items === null && loading ? (
        <div className="page-status">
          <span className="spinner" aria-hidden="true" />
          Carregando itens…
        </div>
      ) : items && items.length === 0 ? (
        <p className="profile-empty">
          {filtered ? "Nenhum item com esses filtros." : "Nenhum item na loja ainda. Crie o primeiro."}
        </p>
      ) : (
        <ul className="catalog-list">
          {items?.map((item) => {
            const busy = busyId === item.id;
            return (
              <li key={item.id} className="profile-card catalog-row shop-row">
                <ItemThumb item={item} />
                <div className="catalog-main">
                  <div className="catalog-title">
                    <strong>{item.name}</strong>
                    <span className={`status-chip ${STATUS_TONE[item.status]}`}>{SHOP_STATUS_LABEL[item.status]}</span>
                  </div>
                  <span className="muted">
                    {SHOP_CATEGORY_LABEL[item.category]} · {SHOP_TIER_LABEL[item.tier]} ·{" "}
                    {item.price.toLocaleString("pt-BR")} diamantes
                  </span>
                  <span className="muted">
                    {ownersLabel(item.owners)}
                    {item.stock != null ? ` · estoque ${item.sold}/${item.stock}` : ""}
                  </span>
                  {item.description ? <p className="catalog-description">{item.description}</p> : null}
                </div>
                <div className="catalog-row-actions shop-row-actions">
                  <button type="button" className="btn" onClick={() => setEditing(item)} disabled={busy}>
                    Editar
                  </button>
                  {item.status === "on_sale" ? (
                    <button type="button" className="btn" onClick={() => void setItemStatus(item, "off_sale")} disabled={busy}>
                      Tirar de venda
                    </button>
                  ) : (
                    <button type="button" className="btn" onClick={() => void setItemStatus(item, "on_sale")} disabled={busy}>
                      Pôr à venda
                    </button>
                  )}
                  {item.owners === 0 ? (
                    <button type="button" className="btn" onClick={() => void remove(item)} disabled={busy}>
                      Apagar
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing ? (
        <ShopItemForm
          session={session}
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            setNotice(`${saved.name} foi salvo.`);
            setVersion((value) => value + 1);
          }}
        />
      ) : null}
      {dialog}
    </section>
  );
}

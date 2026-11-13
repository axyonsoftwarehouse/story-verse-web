import { useState, type ChangeEvent, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { SupabaseSession } from "../../lib/auth";
import {
  MIN_NAME_CONTRAST,
  SHOP_CATEGORY_LABEL,
  SHOP_IMAGE_ACCEPT,
  SHOP_IMAGE_HINT,
  SHOP_PRICE_HINT,
  SHOP_STATUS_LABEL,
  SHOP_TIER_LABEL,
  createShopItem,
  updateShopItem,
  uploadShopImage,
  worstNameContrast,
  type AdminShopItem,
  type ShopImageKind,
  type ShopItemInput,
  type ShopStatus,
} from "../../lib/adminShop";
import { shopAssetUrl, type Cosmetics, type ShopCategory, type ShopTier } from "../../lib/shop";
import { PersonFace } from "../groups/GroupParts";
import { PersonName } from "../shop/PersonName";

type Draft = {
  category: ShopCategory;
  tier: ShopTier;
  name: string;
  description: string;
  price: string;
  status: ShopStatus;
  image_url: string | null;
  animated_url: string | null;
  colors: string[];
  sortOrder: string;
  stock: string;
  availableFrom: string;
  availableUntil: string;
};

const CATEGORIES: ShopCategory[] = ["frame", "badge", "cover", "name_color"];
const TIERS: ShopTier[] = ["common", "rare", "epic"];
const STATUSES: ShopStatus[] = ["draft", "on_sale", "off_sale"];
const DEFAULT_COLOR = "#f4d58d";
const SAMPLE_NAME = "Leitora de exemplo";

/** ISO da API → valor do `datetime-local` (hora local, sem segundos). */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function draftOf(item: AdminShopItem | null): Draft {
  if (!item) {
    return {
      category: "frame",
      tier: "common",
      name: "",
      description: "",
      price: "100",
      status: "draft",
      image_url: null,
      animated_url: null,
      colors: [DEFAULT_COLOR],
      sortOrder: "0",
      stock: "",
      availableFrom: "",
      availableUntil: "",
    };
  }
  return {
    category: item.category,
    tier: item.tier,
    name: item.name,
    description: item.description ?? "",
    price: String(item.price),
    status: item.status,
    image_url: item.image_url,
    animated_url: item.animated_url,
    colors: item.colors?.length ? item.colors : [DEFAULT_COLOR],
    sortOrder: String(item.sort_order ?? 0),
    stock: item.stock == null ? "" : String(item.stock),
    availableFrom: toLocalInput(item.available_from),
    availableUntil: toLocalInput(item.available_until),
  };
}

const isEpicFrame = (draft: Draft) => draft.category === "frame" && draft.tier === "epic";

function toInput(draft: Draft): ShopItemInput {
  const colored = draft.category === "name_color";
  return {
    category: draft.category,
    tier: draft.tier,
    name: draft.name.trim(),
    description: draft.description.trim(),
    price: Number(draft.price),
    status: draft.status,
    image_url: colored ? null : draft.image_url,
    animated_url: isEpicFrame(draft) ? draft.animated_url : null,
    colors: colored ? draft.colors : null,
    sort_order: draft.sortOrder.trim() ? Number(draft.sortOrder) : 0,
    available_from: fromLocalInput(draft.availableFrom),
    available_until: fromLocalInput(draft.availableUntil),
    stock: draft.stock.trim() ? Number(draft.stock) : null,
  };
}

/** O que o servidor também recusaria, dito antes de enviar. */
function problemOf(draft: Draft): string {
  if (!draft.name.trim()) return "Informe o nome do item.";
  const price = Number(draft.price);
  if (!Number.isInteger(price) || price < 1 || price > 1_000_000) return "Preço inválido (de 1 a 1.000.000 diamantes).";
  if (draft.stock.trim() && !(Number.isInteger(Number(draft.stock)) && Number(draft.stock) >= 0)) return "Estoque inválido.";
  if (draft.sortOrder.trim() && !Number.isInteger(Number(draft.sortOrder))) return "Ordem inválida.";
  if (isEpicFrame(draft) && (!draft.image_url || !draft.animated_url)) {
    return "Moldura épica precisa das duas imagens: parada e animada.";
  }
  if (draft.category !== "name_color" && draft.status === "on_sale" && !draft.image_url) {
    return "Envie a imagem antes de pôr o item à venda.";
  }
  return "";
}

/** Enfeites do formulário, para a prévia no avatar de exemplo. */
function cosmeticsOf(draft: Draft): Cosmetics {
  return {
    frame:
      draft.category === "frame" && draft.image_url
        ? { image: draft.image_url, animated: isEpicFrame(draft) ? draft.animated_url : null, tier: draft.tier }
        : null,
    badge: draft.category === "badge" && draft.image_url ? { image: draft.image_url, name: draft.name || "Insígnia" } : null,
    name_color: draft.category === "name_color" ? draft.colors : null,
  };
}

function UploadField({
  kind,
  label,
  url,
  uploading,
  error,
  disabled,
  onPick,
}: {
  kind: ShopImageKind;
  label: string;
  url: string | null;
  uploading: boolean;
  error: string;
  disabled: boolean;
  onPick: (kind: ShopImageKind, file: File) => void;
}) {
  const src = url ? shopAssetUrl(url) : "";
  return (
    <div className={`shop-upload shop-upload-${kind}`}>
      <span className="shop-upload-title">{label}</span>
      <div className="shop-upload-row">
        <span className="shop-upload-thumb">
          {src ? <img src={src} alt="" referrerPolicy="no-referrer" /> : <span className="muted">Sem imagem</span>}
        </span>
        <div className="shop-upload-actions">
          <label className="btn">
            {uploading ? "Enviando…" : src ? "Trocar imagem" : "Enviar imagem"}
            <input
              type="file"
              aria-label={label}
              accept={SHOP_IMAGE_ACCEPT[kind]}
              disabled={disabled || uploading}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onPick(kind, file);
              }}
            />
          </label>
          <span className="muted">{SHOP_IMAGE_HINT[kind]}</span>
        </div>
      </div>
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ShopItemForm({
  session,
  item,
  onClose,
  onSaved,
}: {
  session: SupabaseSession;
  /** null = item novo. */
  item: AdminShopItem | null;
  onClose: () => void;
  onSaved: (item: AdminShopItem) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(item));
  const [uploading, setUploading] = useState<ShopImageKind | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Partial<Record<ShopImageKind, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const editing = item !== null;
  const colored = draft.category === "name_color";
  const lowContrast = colored
    ? [...new Set(draft.colors.filter((color) => worstNameContrast(color) < MIN_NAME_CONTRAST))]
    : [];
  const cosmetics = cosmeticsOf(draft);
  const coverSrc = draft.category === "cover" && draft.image_url ? shopAssetUrl(draft.image_url) : "";
  const staticKind: ShopImageKind = draft.category === "frame" ? "frame" : draft.category === "badge" ? "badge" : "cover";

  function patch(next: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...next }));
    setError("");
  }

  function changeCategory(category: ShopCategory) {
    // As imagens são conferidas por tipo na API: trocar o tipo descarta o que foi enviado.
    setDraft((current) => ({ ...current, category, image_url: null, animated_url: null }));
    setUploadErrors({});
    setError("");
  }

  async function pick(kind: ShopImageKind, file: File) {
    setUploading(kind);
    setUploadErrors((current) => ({ ...current, [kind]: "" }));
    try {
      const url = await uploadShopImage(session, kind, file);
      setDraft((current) =>
        kind === "frame_animated" ? { ...current, animated_url: url } : { ...current, image_url: url },
      );
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Não foi possível enviar a imagem.";
      setUploadErrors((current) => ({ ...current, [kind]: message }));
    } finally {
      setUploading(null);
    }
  }

  function setColor(index: number, color: string) {
    setDraft((current) => ({ ...current, colors: current.colors.map((c, i) => (i === index ? color.toLowerCase() : c)) }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || lowContrast.length > 0) return;
    const problem = problemOf(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const input = toInput(draft);
      const saved = item ? await updateShopItem(session, item.id, input) : await createShopItem(session, input);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Não foi possível salvar o item.");
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="about-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}
    >
      <section className="about-dialog catalog-wizard shop-item-dialog" role="dialog" aria-modal="true" aria-labelledby="shop-item-title">
        <header className="about-dialog-head">
          <div>
            <span className="eyebrow">Loja · {editing ? "editar item" : "novo item"}</span>
            <h2 id="shop-item-title">{editing ? item.name : "Novo item"}</h2>
          </div>
          <button type="button" className="auth-close" onClick={onClose} aria-label="Fechar formulário" disabled={busy}>
            ×
          </button>
        </header>

        <form className="catalog-wizard-form shop-item-form" onSubmit={submit}>
          <div className="shop-item-layout">
            <div className="catalog-form-grid">
              <label className="catalog-field">
                Tipo
                <select
                  value={draft.category}
                  onChange={(event) => changeCategory(event.target.value as ShopCategory)}
                  disabled={busy || editing}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {SHOP_CATEGORY_LABEL[category]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="catalog-field">
                Nível
                <select value={draft.tier} onChange={(event) => patch({ tier: event.target.value as ShopTier })} disabled={busy}>
                  {TIERS.map((tier) => (
                    <option key={tier} value={tier}>
                      {SHOP_TIER_LABEL[tier]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="catalog-field is-wide">
                Nome
                <input value={draft.name} maxLength={60} onChange={(event) => patch({ name: event.target.value })} disabled={busy} />
              </label>

              <label className="catalog-field is-wide">
                Descrição
                <textarea
                  rows={2}
                  value={draft.description}
                  maxLength={200}
                  onChange={(event) => patch({ description: event.target.value })}
                  disabled={busy}
                />
              </label>

              <div className="catalog-field">
                <label htmlFor="shop-item-price">Preço (diamantes)</label>
                <input
                  id="shop-item-price"
                  type="number"
                  min={1}
                  max={1000000}
                  step={1}
                  value={draft.price}
                  onChange={(event) => patch({ price: event.target.value })}
                  disabled={busy}
                />
                <span className="shop-field-hint">{SHOP_PRICE_HINT[draft.tier]}</span>
              </div>

              <label className="catalog-field">
                Estado
                <select value={draft.status} onChange={(event) => patch({ status: event.target.value as ShopStatus })} disabled={busy}>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {SHOP_STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="catalog-field is-wide shop-visual">
                {colored ? (
                  <div className="shop-colors">
                    <span className="shop-upload-title">Cores do nome</span>
                    <div className="shop-color-list">
                      {draft.colors.map((color, index) => (
                        <span key={index} className="shop-color">
                          <input
                            type="color"
                            aria-label={`Cor ${index + 1}`}
                            value={color}
                            onChange={(event) => setColor(index, event.target.value)}
                            disabled={busy}
                          />
                          <code>{color}</code>
                          {draft.colors.length > 1 ? (
                            <button
                              type="button"
                              className="inline-link"
                              aria-label={`Tirar cor ${index + 1}`}
                              onClick={() => patch({ colors: draft.colors.filter((_, i) => i !== index) })}
                              disabled={busy}
                            >
                              Tirar
                            </button>
                          ) : null}
                        </span>
                      ))}
                      {draft.colors.length < 3 ? (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => patch({ colors: [...draft.colors, draft.colors[draft.colors.length - 1] ?? DEFAULT_COLOR] })}
                          disabled={busy}
                        >
                          Adicionar cor
                        </button>
                      ) : null}
                    </div>
                    <span className="shop-field-hint">
                      Uma cor lisa ou um degradê de 2 a 3 cores. Cada cor precisa ser legível no fundo escuro do perfil e do
                      chat (mínimo 4,5:1).
                    </span>
                    {lowContrast.length > 0 ? (
                      <div className="auth-error" role="alert">
                        {lowContrast.map((color) => (
                          <p key={color}>
                            {color} tem pouco contraste com o fundo escuro ({worstNameContrast(color).toFixed(1).replace(".", ",")}:1;
                            mínimo 4,5:1). Escolha uma cor mais clara.
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <UploadField
                      kind={staticKind}
                      label={draft.category === "frame" ? "Imagem parada" : "Imagem"}
                      url={draft.image_url}
                      uploading={uploading === staticKind}
                      error={uploadErrors[staticKind] ?? ""}
                      disabled={busy}
                      onPick={pick}
                    />
                    {isEpicFrame(draft) ? (
                      <UploadField
                        kind="frame_animated"
                        label="Imagem animada"
                        url={draft.animated_url}
                        uploading={uploading === "frame_animated"}
                        error={uploadErrors.frame_animated ?? ""}
                        disabled={busy}
                        onPick={pick}
                      />
                    ) : null}
                    {isEpicFrame(draft) ? (
                      <span className="shop-field-hint">Moldura épica leva as duas: a animada no perfil, a parada no resto do site.</span>
                    ) : null}
                  </>
                )}
              </div>

              <details className="catalog-field is-wide shop-more">
                <summary>Mais opções</summary>
                <div className="catalog-form-grid">
                  <label className="catalog-field">
                    Ordem na loja
                    <input type="number" step={1} value={draft.sortOrder} onChange={(event) => patch({ sortOrder: event.target.value })} disabled={busy} />
                  </label>
                  <label className="catalog-field">
                    Estoque (vazio = sem limite)
                    <input type="number" min={0} step={1} value={draft.stock} onChange={(event) => patch({ stock: event.target.value })} disabled={busy} />
                  </label>
                  <label className="catalog-field">
                    À venda a partir de
                    <input type="datetime-local" value={draft.availableFrom} onChange={(event) => patch({ availableFrom: event.target.value })} disabled={busy} />
                  </label>
                  <label className="catalog-field">
                    À venda até
                    <input type="datetime-local" value={draft.availableUntil} onChange={(event) => patch({ availableUntil: event.target.value })} disabled={busy} />
                  </label>
                </div>
              </details>
            </div>

            <aside className="shop-item-preview" aria-label="Prévia do item">
              <span className="shop-upload-title">Prévia</span>
              {draft.category === "cover" ? (
                <div className="shop-preview-banner">
                  {coverSrc ? <img src={coverSrc} alt="" referrerPolicy="no-referrer" /> : <span className="muted">Sem capa</span>}
                  <span className="shop-preview-banner-face">
                    <PersonFace id="exemplo" name={SAMPLE_NAME} size="lg" cosmetics={cosmetics} />
                  </span>
                </div>
              ) : (
                <div className="shop-preview-profile">
                  <PersonFace id="exemplo" name={SAMPLE_NAME} size="lg" cosmetics={cosmetics} animate />
                </div>
              )}
              <PersonName className="shop-preview-name" name={SAMPLE_NAME} cosmetics={cosmetics} />
              <span className="shop-field-hint">No perfil</span>
              <div className="shop-preview-chat">
                <PersonFace id="exemplo" name={SAMPLE_NAME} size="sm" cosmetics={cosmetics} />
                <span className="shop-preview-chat-text">
                  <PersonName name={SAMPLE_NAME} cosmetics={cosmetics} />
                  <span className="muted">Que capítulo bonito!</span>
                </span>
              </div>
              <span className="shop-field-hint">No chat</span>
            </aside>
          </div>

          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="catalog-wizard-actions">
            <button type="button" className="btn" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy || uploading !== null || lowContrast.length > 0}>
              {busy ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}

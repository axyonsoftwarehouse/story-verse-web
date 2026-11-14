import type { CSSProperties } from "react";
import type { SupabaseSession } from "./auth";
import { rpc } from "./rpc";

/** Loja de itens de perfil (molduras, selos, capas, cores de nome) comprados com diamantes. */

export type ShopCategory = "frame" | "badge" | "cover" | "name_color";
export type ShopTier = "common" | "rare" | "epic";

export type Cosmetics = {
  frame: { image: string; animated: string | null; tier: ShopTier } | null;
  badge: { image: string; name: string } | null;
  name_color: string[] | null;
};

export type ShopItem = {
  id: string;
  category: ShopCategory;
  tier: ShopTier;
  name: string;
  description: string;
  price: number;
  image_url: string;
  animated_url: string | null;
  colors: string[] | null;
  owned: boolean;
  equipped: boolean;
  available_until: string | null;
  remaining: number | null;
};

export type OwnedItem = {
  item_id: string;
  category: ShopCategory;
  tier: ShopTier;
  name: string;
  image_url: string;
  animated_url: string | null;
  colors: string[] | null;
  equipped: boolean;
  price_paid: number;
  bought_at: string;
};

export type BuyShopResult = { balance: number; item_id: string; duplicate: boolean };

const call = <T>(session: SupabaseSession, name: string, args: object = {}) =>
  rpc<T>(session, name, args, { feature: "A loja" });

/** Um `ref` por intenção de compra: gerado ao abrir a confirmação, reusado se a rede falhar. */
export function newRef(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function fetchShopCatalog(session: SupabaseSession): Promise<ShopItem[]> {
  return (await call<ShopItem[]>(session, "shop_catalog")) ?? [];
}

export async function fetchMyShopItems(session: SupabaseSession): Promise<OwnedItem[]> {
  return (await call<OwnedItem[]>(session, "my_shop_items")) ?? [];
}

export async function buyShopItem(session: SupabaseSession, itemId: string, ref = newRef()): Promise<BuyShopResult> {
  const rows = (await call<BuyShopResult[]>(session, "buy_shop_item", { item: itemId, ref })) ?? [];
  const result = rows[0];
  if (!result) throw new Error("Não foi possível comprar o item.");
  return result;
}

/** Equipa o item da categoria (ou tira, com `null`). Devolve os enfeites já equipados. */
export async function equipShopItem(
  session: SupabaseSession,
  category: ShopCategory,
  itemId: string | null,
): Promise<Cosmetics> {
  const result = await call<Cosmetics>(session, "equip_shop_item", { category, item: itemId });
  if (!result) throw new Error("Não foi possível equipar o item.");
  return result;
}

/** Caminho `/shop/...` vira absoluto na origem do app; https passa igual; o resto é descartado. */
export function shopAssetUrl(url: string): string {
  if (/^\/shop\/[A-Za-z0-9._-]+$/.test(url)) return `${window.location.origin}${url}`;
  if (/^https:\/\//i.test(url)) return url;
  return "";
}

/**
 * Capa que o perfil mostra: a comprada (equipada) vence a foto enviada. Devolve um endereço seguro
 * para `url("...")`, ou null sem capa.
 */
export function profileCoverUrl(shopCover: string | null | undefined, cover: string | null | undefined): string | null {
  const bought = shopCover ? shopAssetUrl(shopCover) : "";
  if (bought) return bought;
  if (typeof cover === "string" && /^(https?:\/\/|blob:)/i.test(cover) && !/["\\\s]/.test(cover)) return cover;
  return null;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Estilo do nome com a cor comprada: uma cor lisa ou um degradê no texto. */
export function nameColorStyle(colors: string[] | null): CSSProperties | undefined {
  const valid = (colors ?? []).filter((c) => typeof c === "string" && HEX_COLOR.test(c)).slice(0, 3);
  if (valid.length === 0) return undefined;
  if (valid.length === 1) return { color: valid[0] };
  return {
    backgroundImage: `linear-gradient(90deg, ${valid.join(", ")})`,
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    color: "transparent",
  };
}

function luminance(hex: string): number {
  if (!HEX_COLOR.test(hex)) throw new Error(`Cor inválida: ${hex}`);
  const n = parseInt(hex.replace("#", ""), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

/** Contraste WCAG entre duas cores `#rrggbb` (1 a 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

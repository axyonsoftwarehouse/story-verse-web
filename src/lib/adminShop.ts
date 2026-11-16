import type { SupabaseSession } from "./auth";
import { apiFetch, apiRequest } from "./backend";
import { contrastRatio, type ShopCategory, type ShopTier } from "./shop";

/** Itens da loja no painel (só superadmin; a API recusa os outros papéis com 403). */

export type ShopStatus = "draft" | "on_sale" | "off_sale";
export type ShopImageKind = "frame" | "frame_animated" | "badge" | "cover";

export type AdminShopItem = {
  id: string;
  category: ShopCategory;
  tier: ShopTier;
  name: string;
  description: string;
  price: number;
  status: ShopStatus;
  image_url: string | null;
  animated_url: string | null;
  colors: string[] | null;
  sort_order: number;
  available_from: string | null;
  available_until: string | null;
  stock: number | null;
  sold: number;
  /** Quantas contas têm o item; com dono ele não pode ser apagado, só tirado de venda. */
  owners: number;
  created_at: string;
  updated_at: string;
};

/** Corpo do POST/PUT: o PUT troca todos os campos editáveis, então vai sempre o item inteiro. */
export type ShopItemInput = {
  category: ShopCategory;
  tier: ShopTier;
  name: string;
  description: string;
  price: number;
  status: ShopStatus;
  image_url: string | null;
  animated_url: string | null;
  colors: string[] | null;
  sort_order: number;
  available_from: string | null;
  available_until: string | null;
  stock: number | null;
};

export const SHOP_CATEGORY_LABEL: Record<ShopCategory, string> = {
  frame: "Moldura",
  badge: "Insígnia",
  cover: "Capa",
  name_color: "Nome colorido",
};

export const SHOP_TIER_LABEL: Record<ShopTier, string> = { common: "Comum", rare: "Raro", epic: "Épico" };

export const SHOP_STATUS_LABEL: Record<ShopStatus, string> = {
  draft: "Rascunho",
  on_sale: "À venda",
  off_sale: "Fora de venda",
};

/** Faixa de preço sugerida por nível (só dica; a API aceita de 1 a 1.000.000). */
export const SHOP_PRICE_HINT: Record<ShopTier, string> = {
  common: "Comum: de 50 a 150 diamantes.",
  rare: "Raro: de 300 a 600 diamantes.",
  epic: "Épico: a partir de 800 diamantes.",
};

/** Regras de imagem que a API confere pelos bytes, mostradas como dica no formulário. */
export const SHOP_IMAGE_HINT: Record<ShopImageKind, string> = {
  frame: "PNG ou WebP com fundo transparente, quadrada, de 128 a 1024 px, até 1 MB.",
  frame_animated: "WebP animado, quadrado, de 128 a 1024 px, até 3 MB.",
  badge: "PNG ou WebP com transparência, quadrada, de 128 a 1024 px, até 1 MB.",
  cover: "PNG, WebP ou JPEG na proporção 3:1, de 750 a 3000 px de largura, até 1 MB.",
};

export const SHOP_IMAGE_ACCEPT: Record<ShopImageKind, string> = {
  frame: "image/png,image/webp",
  frame_animated: "image/webp",
  badge: "image/png,image/webp",
  cover: "image/png,image/webp,image/jpeg",
};

/** Fundos escuros onde o nome aparece (perfil e chat); a API usa os mesmos. */
export const NAME_BACKGROUNDS = ["#14110e", "#0e1612"];
export const MIN_NAME_CONTRAST = 4.5;

/** Pior contraste da cor entre os fundos do nome. */
export function worstNameContrast(color: string): number {
  return Math.min(...NAME_BACKGROUNDS.map((background) => contrastRatio(color, background)));
}

export function listShopItems(
  session: SupabaseSession,
  filters: { category?: ShopCategory | ""; status?: ShopStatus | "" } = {},
): Promise<AdminShopItem[]> {
  const query = new URLSearchParams();
  if (filters.category) query.set("category", filters.category);
  if (filters.status) query.set("status", filters.status);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<AdminShopItem[]>(`/api/v1/admin/shop/items${suffix}`, {
    accessToken: session.access_token,
  });
}

export function createShopItem(session: SupabaseSession, input: ShopItemInput): Promise<AdminShopItem> {
  return apiRequest<AdminShopItem>("/api/v1/admin/shop/items", {
    method: "POST",
    body: input,
    accessToken: session.access_token,
  });
}

export function updateShopItem(session: SupabaseSession, id: string, input: ShopItemInput): Promise<AdminShopItem> {
  return apiRequest<AdminShopItem>(`/api/v1/admin/shop/items/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: input,
    accessToken: session.access_token,
  });
}

/** 409 com mensagem se alguém já tem o item. */
export async function deleteShopItem(session: SupabaseSession, id: string): Promise<void> {
  await apiRequest<unknown>(`/api/v1/admin/shop/items/${encodeURIComponent(id)}`, {
    method: "DELETE",
    accessToken: session.access_token,
  });
}

/** Envia a imagem (multipart `file`); a API confere tipo real, tamanho e dimensões e devolve a URL. */
export async function uploadShopImage(session: SupabaseSession, kind: ShopImageKind, file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await apiFetch(`/api/v1/admin/shop/images?kind=${encodeURIComponent(kind)}`, {
    method: "POST",
    body: form,
    accessToken: session.access_token,
  });
  const payload = (await res.json().catch(() => ({}))) as { url?: unknown; error?: unknown; message?: unknown };
  if (!res.ok) {
    const server = typeof payload.error === "string" ? payload.error : typeof payload.message === "string" ? payload.message : "";
    if (res.status === 401) throw new Error("Sessão expirada. Entre novamente.");
    if (res.status === 413) throw new Error(server || "Arquivo grande demais.");
    if (res.status >= 500 || !server) throw new Error("Não foi possível enviar a imagem. Tente de novo.");
    throw new Error(server);
  }
  if (typeof payload.url !== "string" || !payload.url) throw new Error("Não foi possível enviar a imagem. Tente de novo.");
  return payload.url;
}

export function toShopItemInput(item: AdminShopItem): ShopItemInput {
  return {
    category: item.category,
    tier: item.tier,
    name: item.name,
    description: item.description ?? "",
    price: item.price,
    status: item.status,
    image_url: item.image_url,
    animated_url: item.animated_url,
    colors: item.colors,
    sort_order: item.sort_order ?? 0,
    available_from: item.available_from,
    available_until: item.available_until,
    stock: item.stock,
  };
}

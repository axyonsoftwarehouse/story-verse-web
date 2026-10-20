import type { SupabaseSession } from "./auth";
import { rpc } from "./rpc";

/**
 * Presentes: o leitor gasta diamantes para enviar um cosmético a outro leitor. O banco valida
 * saldo, limite diário e idade da conta; o item nunca transfere diamantes.
 */

export type GiftCatalogItem = {
  id: string;
  name: string;
  icon: string;
  price: number;
  rarity: "common" | "rare" | "epic" | string;
};

export type SendGiftResult = {
  balance: number;
  daily_limit: number;
  remaining_today: number;
  week_count: number;
  duplicate: boolean;
};

export type ReceivedGift = {
  gift_id: string;
  name: string;
  icon: string;
  price: number;
  from_user: string;
  from_name: string;
  created_at: string;
};

export type GiftSummary = {
  received_total: number;
  received_this_week: number;
  sent_this_week: number;
};

export type WeeklyGiftCount = {
  user_id: string;
  gifts_received: number;
};

const call = <T>(session: SupabaseSession, name: string, args: object = {}) =>
  rpc<T>(session, name, args, { feature: "Os presentes" });

function newRef(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function fetchGiftCatalog(session: SupabaseSession): Promise<GiftCatalogItem[]> {
  return (await call<GiftCatalogItem[]>(session, "gift_catalog")) ?? [];
}

export async function sendGift(
  session: SupabaseSession,
  toUser: string,
  giftId: string,
  ref = newRef(),
): Promise<SendGiftResult> {
  const rows =
    (await call<SendGiftResult[]>(session, "send_gift", {
      p_to: toUser,
      p_gift: giftId,
      p_ref: ref,
    })) ?? [];
  const result = rows[0];
  if (!result) throw new Error("Não foi possível enviar o presente.");
  return result;
}

export async function fetchReceivedGifts(
  session: SupabaseSession,
  limit = 20,
): Promise<ReceivedGift[]> {
  return (
    (await call<ReceivedGift[]>(session, "my_gifts_received", { p_limit: limit })) ?? []
  );
}

export async function fetchGiftSummary(session: SupabaseSession): Promise<GiftSummary> {
  const rows = (await call<GiftSummary[]>(session, "my_gift_summary")) ?? [];
  return rows[0] ?? { received_total: 0, received_this_week: 0, sent_this_week: 0 };
}

export async function fetchWeeklyGiftCounts(
  session: SupabaseSession,
  offset: 0 | -1,
): Promise<Record<string, number>> {
  const rows =
    (await call<WeeklyGiftCount[]>(session, "weekly_gift_counts", { p_offset: offset })) ?? [];
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.user_id] = row.gifts_received;
  return counts;
}

/** Texto curto para a lista de recebidos. */
export function giftDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");
}

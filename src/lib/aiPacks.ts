import type { SupabaseSession } from "./auth";
import { rpc } from "./rpc";

/** Pacotes de mensagens extras comprados com diamantes. O saldo oficial fica no servidor. */

export type AiPack = {
  id: string;
  name: string;
  messages: number;
  price: number;
};

export type BuyPackResult = {
  diamond_balance: number;
  credits_balance: number;
  messages: number;
  duplicate: boolean;
};

const call = <T>(session: SupabaseSession, name: string, args: object = {}) =>
  rpc<T>(session, name, args, { feature: "Os pacotes de mensagens" });

function newRef(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function fetchAiPacks(session: SupabaseSession): Promise<AiPack[]> {
  return (await call<AiPack[]>(session, "ai_pack_catalog")) ?? [];
}

export async function buyAiPack(
  session: SupabaseSession,
  packId: string,
  ref = newRef(),
): Promise<BuyPackResult> {
  const rows =
    (await call<BuyPackResult[]>(session, "buy_ai_pack", {
      p_pack: packId,
      p_ref: ref,
    })) ?? [];
  const result = rows[0];
  if (!result) throw new Error("Não foi possível comprar o pacote.");
  return result;
}

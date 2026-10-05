import type { SupabaseSession } from "./auth";
import { applyStreakRescue, mergeBoughtFreezes, recentReadingSeconds, streakRescue, type StreakRescue } from "./readingStats";
import { rpc } from "./rpc";

/**
 * Diamantes (Supabase): saldo, extrato, recompensa por leitura e o Salva-ofensiva. O saldo só
 * muda no banco (supabase/diamonds.sql), que trava a carteira a cada lançamento — o app só pede
 * e mostra. Compra de pacotes ainda não existe (o extrato já aceita o motivo "purchase").
 */

export type Wallet = {
  balance: number;
  freezes_this_week: number;
  freeze_price: number;
  freezes_per_week: number;
  goal_minutes: number;
  goal_reward: number;
};

export type DiamondReason = "ranking" | "reading_goal" | "streak_freeze" | "purchase" | "adjustment";

export type DiamondEntry = { amount: number; balance_after: number; reason: DiamondReason; ref: string; created_at: string };

const call = <T>(session: SupabaseSession, name: string, args: object = {}) =>
  rpc<T>(session, name, args, { feature: "A loja de diamantes" });

export async function fetchWallet(session: SupabaseSession): Promise<Wallet> {
  const rows = (await call<Wallet[]>(session, "my_wallet")) ?? [];
  const w = rows[0];
  if (!w) throw new Error("Entre na sua conta para ver seus diamantes.");
  return w;
}

export async function fetchDiamondHistory(session: SupabaseSession, limit = 30): Promise<DiamondEntry[]> {
  return (await call<DiamondEntry[]>(session, "my_diamond_history", { p_limit: limit })) ?? [];
}

/** Texto do extrato: de onde veio ou para onde foi cada lançamento. */
export function diamondEntryLabel(e: DiamondEntry): string {
  const day = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");
  };
  switch (e.reason) {
    case "ranking":
      return `Pódio do ranking (semana de ${day(e.ref)})`;
    case "reading_goal":
      return `Leitura do dia ${day(e.ref)}`;
    case "streak_freeze":
      return `Salva-ofensiva (${day(e.ref)})`;
    case "purchase":
      return "Compra de diamantes";
    default:
      return "Ajuste";
  }
}

/** Dias da recompensa por leitura já pagos (nesta visita), para não pedir de novo à toa. */
const rewardedDays = new Map<string, Set<string>>();

/**
 * Recompensa por leitura: pede ao banco os diamantes dos dias com a leitura mínima. Só chama
 * quando há dia novo que pode render. Devolve quantos diamantes entraram agora.
 */
export async function claimReadingRewards(session: SupabaseSession, goalMinutes = 10): Promise<number> {
  const done = rewardedDays.get(session.user.id) ?? new Set<string>();
  rewardedDays.set(session.user.id, done);
  const candidates = Object.entries(recentReadingSeconds(8)).filter(([d, s]) => s >= goalMinutes * 60 && !done.has(d));
  if (candidates.length === 0) return 0;
  const rows = (await call<{ day: string; diamonds: number; is_new: boolean }[]>(session, "claim_reading_rewards")) ?? [];
  for (const r of rows) done.add(r.day);
  return rows.filter((r) => r.is_new).reduce((sum, r) => sum + r.diamonds, 0);
}

/** Traz para este aparelho os dias salvos com diamantes em outro. Diz se mudou algo. */
export async function syncBoughtFreezes(session: SupabaseSession): Promise<boolean> {
  const days = (await call<string[]>(session, "my_streak_freezes")) ?? [];
  return mergeBoughtFreezes(days);
}

/** Paga o Salva-ofensiva dos dias e aplica no aparelho. Devolve a sequência salva e o saldo. */
export async function rescueStreak(session: SupabaseSession, rescue: StreakRescue): Promise<{ streak: number; balance: number | null }> {
  const balance = rescue.paidDays.length
    ? await call<number>(session, "use_streak_freeze", { p_days: rescue.paidDays })
    : null;
  return { streak: applyStreakRescue(rescue), balance };
}

/** O que fazer com a sequência quebrada: nada, avisar (manual) ou já salvou (automático). */
export type FreezeOutcome =
  | { kind: "saved"; streak: number; spent: number; balance: number | null }
  | { kind: "offer"; rescue: StreakRescue; wallet: Wallet; reason: "manual" | "no-balance" | "limit" };

/**
 * Ao abrir o app: junta os dias salvos de outros aparelhos e, se a sequência quebrou, salva
 * sozinho (com o automático ligado e saldo) ou devolve a oferta para a tela mostrar.
 */
export async function checkStreakFreeze(session: SupabaseSession): Promise<FreezeOutcome | null> {
  await syncBoughtFreezes(session).catch(() => false);
  const rescue = streakRescue();
  if (!rescue || rescue.paidDays.length === 0) return null;
  const wallet = await fetchWallet(session);
  const cost = rescue.paidDays.length * wallet.freeze_price;
  // O limite da semana é conferido de verdade no banco; aqui é só para não oferecer o impossível.
  if (rescue.paidDays.length > wallet.freezes_per_week) return null;
  if (wallet.balance < cost) return { kind: "offer", rescue, wallet, reason: "no-balance" };
  if (!autoFreezeEnabled()) return { kind: "offer", rescue, wallet, reason: "manual" };
  try {
    const r = await rescueStreak(session, rescue);
    return { kind: "saved", streak: r.streak, spent: cost, balance: r.balance };
  } catch (err) {
    if (err instanceof Error && err.message.includes("desta semana")) return { kind: "offer", rescue, wallet, reason: "limit" };
    throw err;
  }
}

const AUTO_KEY = "storyverse:auto-freeze";

/** Usar diamantes sozinho quando a sequência quebrar (ligado, a não ser que a pessoa desligue). */
export function autoFreezeEnabled(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setAutoFreezeEnabled(on: boolean) {
  try {
    localStorage.setItem(AUTO_KEY, String(on));
  } catch {
    // Sem armazenamento.
  }
}

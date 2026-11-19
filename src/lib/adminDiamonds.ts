import type { SupabaseSession } from "./auth";
import { rpc } from "./rpc";

/**
 * Conceder ou tirar diamantes de uma conta pelo painel (só superadmin). Quem confere o papel,
 * acha a conta pelo e-mail e lança no extrato é a função `admin_grant_diamonds` do banco (V63 na
 * API); a nota fica na auditoria e o extrato da pessoa mostra "Ajuste".
 */

export type DiamondGrantInput = { email: string; amount: number; note: string };
export type DiamondGrantResult = { user_id: string; email: string; amount: number; balance: number };

/** Mesmos limites da função no banco; aqui só para avisar antes de enviar. */
export const GRANT_MAX_AMOUNT = 100_000;
export const GRANT_NOTE_MIN = 3;
export const GRANT_NOTE_MAX = 200;

/** Lê a quantidade digitada (aceita sinal e separador de milhar). NaN se não for um inteiro. */
export function parseGrantAmount(raw: string): number {
  let clean = raw.replace(/\s/g, "").replace(/^−/, "-");
  if (/^[+-]?\d{1,3}(\.\d{3})+$/.test(clean)) clean = clean.replace(/\./g, "");
  return /^[+-]?\d+$/.test(clean) ? Number(clean) : Number.NaN;
}

/** Primeiro problema do formulário, ou null se dá para enviar. */
export function grantProblem(input: DiamondGrantInput): string | null {
  const email = input.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Informe o e-mail da conta.";
  if (!Number.isInteger(input.amount) || input.amount === 0) return "Informe uma quantidade diferente de zero.";
  if (Math.abs(input.amount) > GRANT_MAX_AMOUNT) return "Quantidade grande demais (máximo de 100.000 por lançamento).";
  const note = input.note.trim();
  if (note.length < GRANT_NOTE_MIN || note.length > GRANT_NOTE_MAX) return "Escreva o motivo (de 3 a 200 caracteres).";
  return null;
}

export async function grantDiamonds(session: SupabaseSession, input: DiamondGrantInput): Promise<DiamondGrantResult> {
  const rows = await rpc<DiamondGrantResult[]>(
    session,
    "admin_grant_diamonds",
    { p_email: input.email.trim(), p_amount: input.amount, p_note: input.note.trim() },
    { feature: "Conceder diamantes" },
  );
  const row = rows?.[0];
  if (!row) throw new Error("Não foi possível lançar os diamantes.");
  return row;
}

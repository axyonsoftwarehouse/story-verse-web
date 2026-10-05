import { AuthNetworkError, supabaseConfig, type SupabaseSession } from "./auth";
import { recentReadingSeconds } from "./readingStats";

/**
 * Ranking semanal de leitores (Supabase): o app envia os minutos lidos por dia e o banco soma a
 * semana (segunda a domingo, horário de Brasília), monta o pódio e entrega os diamantes. As regras
 * (teto por dia, quem aparece, fechamento da semana) ficam no banco: supabase/weekly-ranking.sql.
 */

export type RankEntry = {
  place: number;
  user_id: string;
  name: string;
  avatar: string | null;
  photo: string | null;
  minutes: number;
  is_me: boolean | null;
};

export type WeeklyAward = { week_start: string; place: 1 | 2 | 3; minutes: number; diamonds: number };

export type RankingProfile = { hidden: boolean; diamonds: number };

function friendly(message: string, status: number): string {
  const m = message.toLowerCase();
  if (m.includes("could not find the function") || m.includes("does not exist") || status === 404) {
    return "O ranking ainda não foi configurado no Supabase.";
  }
  if (status === 401) return "Sua sessão expirou. Entre de novo.";
  return message;
}

async function rpc<T>(session: SupabaseSession, name: string, args: object = {}, keepalive = false): Promise<T> {
  const { url, anonKey } = supabaseConfig();
  let res: Response;
  try {
    res = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      keepalive,
      signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(20_000) : undefined,
    });
  } catch {
    throw new AuthNetworkError("Sem conexão com o servidor. Tente de novo.");
  }
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { message?: string; msg?: string; error?: string };
    const message = payload.message ?? payload.msg ?? payload.error ?? `Erro ${res.status}`;
    console.warn(`[ranking] ${name} → ${res.status}: ${message}`);
    throw new Error(friendly(message, res.status));
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Último envio por conta: só manda de novo quando os minutos mudaram. */
const lastReported = new Map<string, string>();

/** Envia os segundos lidos nos últimos 8 dias (cobre a semana atual e o fim da passada). */
export async function reportReading(session: SupabaseSession, opts: { keepalive?: boolean } = {}): Promise<void> {
  const days = recentReadingSeconds(8);
  if (Object.keys(days).length === 0) return;
  const body = JSON.stringify(days);
  if (lastReported.get(session.user.id) === body) return;
  await rpc<null>(session, "report_reading", { p_days: days }, opts.keepalive);
  lastReported.set(session.user.id, body);
}

/** Ranking desta semana (0) ou da passada (-1): o topo e a sua linha, se você já leu. */
export async function fetchRanking(session: SupabaseSession, offset: 0 | -1, limit = 50): Promise<RankEntry[]> {
  return (await rpc<RankEntry[]>(session, "weekly_ranking", { p_offset: offset, p_limit: limit })) ?? [];
}

export async function fetchRankingProfile(session: SupabaseSession): Promise<RankingProfile> {
  const rows = (await rpc<RankingProfile[]>(session, "my_ranking_profile")) ?? [];
  return rows[0] ?? { hidden: false, diamonds: 0 };
}

export async function setRankingHidden(session: SupabaseSession, hidden: boolean): Promise<void> {
  await rpc<null>(session, "set_ranking_hidden", { p_hidden: hidden });
}

/**
 * Pódios conquistados e ainda não vistos (o banco fecha a semana passada aqui, se preciso). Já
 * marca como vistos: o aviso aparece uma vez só, mesmo com o app aberto em dois aparelhos.
 */
export async function takeWeeklyAwards(session: SupabaseSession): Promise<WeeklyAward[]> {
  const awards = (await rpc<WeeklyAward[]>(session, "my_weekly_awards")) ?? [];
  if (awards.length > 0) await rpc<null>(session, "mark_awards_seen").catch(() => {});
  return awards;
}

export const PLACE_MEDALS = { 1: "🥇", 2: "🥈", 3: "🥉" } as const;

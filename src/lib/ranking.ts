import type { SupabaseSession } from "./auth";
import { recentReadingPages } from "./readingPages";
import { recentReadingSeconds } from "./readingStats";
import { rpc } from "./rpc";

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

const call = <T>(session: SupabaseSession, name: string, args: object = {}, keepalive = false) =>
  rpc<T>(session, name, args, { feature: "O ranking", keepalive });

/** Último envio por conta: só manda de novo quando os minutos mudaram. */
const lastReported = new Map<string, string>();

export async function readingHeartbeat(session: SupabaseSession, active: boolean): Promise<void> {
  await call<number>(session, "reading_heartbeat", { p_active: active });
}

/** O banco recusa mais que isso por dia (check de reading_days.pages). */
const MAX_PAGES_PER_DAY = 1000;

/** O que vai para report_reading: `{ "2026-10-27": { seconds, pages } }` por dia. */
export function readingReport(): Record<string, { seconds: number; pages: number }> {
  const seconds = recentReadingSeconds(8);
  const pages = recentReadingPages(8);
  const days: Record<string, { seconds: number; pages: number }> = {};
  for (const day of new Set([...Object.keys(seconds), ...Object.keys(pages)])) {
    days[day] = { seconds: seconds[day] ?? 0, pages: Math.min(MAX_PAGES_PER_DAY, pages[day] ?? 0) };
  }
  return days;
}

/**
 * Envia os segundos e as páginas lidas nos últimos 8 dias (cobre a semana atual e o fim da
 * passada). Os segundos o banco ignora (só o reading_heartbeat conta tempo); as páginas vão para
 * as métricas do painel (ver readingPages.ts). Diz se enviou.
 */
export async function reportReading(session: SupabaseSession, opts: { keepalive?: boolean } = {}): Promise<boolean> {
  const days = readingReport();
  if (Object.keys(days).length === 0) return false;
  const body = JSON.stringify(days);
  if (lastReported.get(session.user.id) === body) return false;
  await call<null>(session, "report_reading", { p_days: days }, opts.keepalive);
  lastReported.set(session.user.id, body);
  return true;
}

/** Ranking desta semana (0) ou da passada (-1): o topo e a sua linha, se você já leu. */
export async function fetchRanking(session: SupabaseSession, offset: 0 | -1, limit = 50): Promise<RankEntry[]> {
  return (await call<RankEntry[]>(session, "weekly_ranking", { p_offset: offset, p_limit: limit })) ?? [];
}

/** Ranking geral: toda a leitura da conta, sem data. Não dá diamantes, só mostra. */
export async function fetchAlltimeRanking(session: SupabaseSession, limit = 50): Promise<RankEntry[]> {
  return (await call<RankEntry[]>(session, "alltime_ranking", { p_limit: limit })) ?? [];
}

export async function fetchRankingProfile(session: SupabaseSession): Promise<RankingProfile> {
  const rows = (await call<RankingProfile[]>(session, "my_ranking_profile")) ?? [];
  return rows[0] ?? { hidden: false, diamonds: 0 };
}

export async function setRankingHidden(session: SupabaseSession, hidden: boolean): Promise<void> {
  await call<null>(session, "set_ranking_hidden", { p_hidden: hidden });
}

/**
 * Pódios conquistados e ainda não vistos (o banco fecha a semana passada aqui, se preciso). Já
 * marca como vistos: o aviso aparece uma vez só, mesmo com o app aberto em dois aparelhos.
 */
export async function takeWeeklyAwards(session: SupabaseSession): Promise<WeeklyAward[]> {
  const awards = (await call<WeeklyAward[]>(session, "my_weekly_awards")) ?? [];
  if (awards.length > 0) await call<null>(session, "mark_awards_seen").catch(() => {});
  return awards;
}

export const PLACE_MEDALS = { 1: "🥇", 2: "🥈", 3: "🥉" } as const;

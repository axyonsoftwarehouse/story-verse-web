import type { SupabaseSession } from "./auth";
import { apiRequest } from "./backend";

export type MetricsRange = { from: string; to: string };

export type MetricsAccounts = {
  total: number;
  /** Janela corrida de 24 horas. Opcional: API anterior à V23 não manda. */
  new24h?: number;
  /** Criadas hoje no calendário de São Paulo. */
  newToday?: number;
  new7: number;
  new30: number;
  confirmed: number;
  staff: number;
};

export type MetricsReading = {
  activeReaders: number;
  minutes: number;
  booksStarted: number;
  booksFinished: number;
  shelfEntries: number;
  /** Páginas lidas, 1 página = 250 palavras (API a partir da V26). */
  pages?: number;
};

export type MetricsRetention = {
  cohortWeek: string;
  cohortSize: number;
  d1: number;
  d7: number;
  d30: number;
};

export type MetricsOverview = {
  accounts: MetricsAccounts;
  reading: MetricsReading;
  features: Record<string, number>;
  retention: MetricsRetention[];
};

export type MetricsReadingPoint = {
  bucket: string;
  activeReaders: number;
  minutes: number;
  booksStarted: number;
  booksFinished: number;
  /** Contas criadas no bucket (API a partir da V23). */
  signups?: number;
  /** Páginas lidas no bucket, 1 página = 250 palavras (API a partir da V26). */
  pages?: number;
};

function rangeParams(range: MetricsRange): string {
  return `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
}

export function getMetricsOverview(
  session: SupabaseSession,
  range: MetricsRange,
): Promise<MetricsOverview> {
  return apiRequest<MetricsOverview>(`/api/v1/admin/metrics/overview?${rangeParams(range)}`, {
    accessToken: session.access_token,
  });
}

export function getReadingSeries(
  session: SupabaseSession,
  range: MetricsRange,
  group: "day" | "week",
): Promise<MetricsReadingPoint[]> {
  return apiRequest<MetricsReadingPoint[]>(
    `/api/v1/admin/metrics/reading?${rangeParams(range)}&group=${group}`,
    { accessToken: session.access_token },
  );
}

export function getMetricsRetention(
  session: SupabaseSession,
  range: MetricsRange,
): Promise<MetricsRetention[]> {
  return apiRequest<MetricsRetention[]>(`/api/v1/admin/metrics/retention?${rangeParams(range)}`, {
    accessToken: session.access_token,
  });
}

import type { MetricsRange, MetricsReadingPoint, MetricsRetention } from "../../lib/adminMetrics";

/** Contas do dashboard: datas no fuso de Brasília (o mesmo das funções admin_metrics_* da API). */

/** Data AAAA-MM-DD em America/Sao_Paulo. */
export function isoDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Soma dias a uma data AAAA-MM-DD (conta em UTC para não sofrer com horário de verão). */
export function shiftDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Os últimos `days` dias terminando em `today`, inclusive. */
export function rangeEnding(today: string, days: number): MetricsRange {
  return { from: shiftDays(today, -(days - 1)), to: today };
}

/** O período atual e o anterior de mesmo tamanho, para comparar. */
export function periodRanges(
  today: string,
  days: number,
): { current: MetricsRange; previous: MetricsRange } {
  const current = rangeEnding(today, days);
  return { current, previous: rangeEnding(shiftDays(current.from, -1), days) };
}

/** Variação percentual; null quando não há base de comparação. */
export function change(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Série diária com todos os dias do intervalo (os que a API não trouxe entram zerados). */
export function fillDays(
  points: MetricsReadingPoint[],
  range: MetricsRange,
): MetricsReadingPoint[] {
  const byDay = new Map(points.map((point) => [point.bucket, point]));
  const out: MetricsReadingPoint[] = [];
  for (let day = range.from; day <= range.to; day = shiftDays(day, 1)) {
    out.push(
      byDay.get(day) ?? {
        bucket: day,
        activeReaders: 0,
        minutes: 0,
        booksStarted: 0,
        booksFinished: 0,
      },
    );
  }
  return out;
}

/**
 * Coorte mais recente com a janela de D7 já fechada: a semana começa na segunda, então o último
 * cadastro dela tem 7 dias completos 13 dias depois do início.
 */
export function latestCompleteD7(rows: MetricsRetention[], today: string): MetricsRetention | null {
  const limit = shiftDays(today, -13);
  const done = rows.filter((row) => row.cohortWeek <= limit && row.cohortSize > 0);
  if (done.length === 0) return null;
  return done.reduce((latest, row) => (row.cohortWeek > latest.cohortWeek ? row : latest));
}

/** Parte do total em %, arredondado; null quando o total é zero. */
export function ratio(part: number, total: number): number | null {
  if (!total) return null;
  return Math.round((part / total) * 100);
}

/** Soma os cadastros dos dias do intervalo; null se a API ainda não manda `signups`. */
export function signupsBetween(points: MetricsReadingPoint[], range: MetricsRange): number | null {
  const inside = points.filter((point) => point.bucket >= range.from && point.bucket <= range.to);
  if (!inside.some((point) => point.signups !== undefined)) return null;
  return inside.reduce((sum, point) => sum + (point.signups ?? 0), 0);
}

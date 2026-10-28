import type { SupabaseSession } from "./auth";
import { apiRequest } from "./backend";
import type { MetricsRange } from "./adminMetrics";

/**
 * Web Vitals do site (superadmin): p75 de LCP, INP e CLS dos envios de performance do tracker do
 * Umami, lidos pela API no servidor. Quando o Umami falha ou não está configurado, a resposta
 * continua 200 com `vitals: null` e o motivo em `error`.
 */

export type VitalMetric = "lcp" | "inp" | "cls";

export type AdminVitals = {
  from: string;
  to: string;
  vitals: {
    /** p75 em milissegundos; null sem medida no período. */
    lcp: number | null;
    /** p75 em milissegundos; null quando ninguém interagiu com a página. */
    inp: number | null;
    /** p75 sem unidade. */
    cls: number | null;
    /** Envios de performance no período. */
    samples: number;
  } | null;
  error: string | null;
};

export type VitalRating = "good" | "needs-improvement" | "poor";

/** Faixas do Google para o p75: até `good` é bom, acima de `poor` é ruim. */
export const VITAL_THRESHOLDS: Record<VitalMetric, { good: number; poor: number }> = {
  lcp: { good: 2500, poor: 4000 },
  inp: { good: 200, poor: 500 },
  cls: { good: 0.1, poor: 0.25 },
};

export function vitalRating(metric: VitalMetric, value: number): VitalRating {
  const { good, poor } = VITAL_THRESHOLDS[metric];
  if (value <= good) return "good";
  return value <= poor ? "needs-improvement" : "poor";
}

export function getVitals(session: SupabaseSession, range: MetricsRange): Promise<AdminVitals> {
  const params = `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
  return apiRequest<AdminVitals>(`/api/v1/admin/vitals?${params}`, {
    accessToken: session.access_token,
  });
}

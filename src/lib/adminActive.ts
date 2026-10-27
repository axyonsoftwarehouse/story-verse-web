import type { SupabaseSession } from "./auth";
import { apiRequest } from "./backend";
import type { MetricsRange } from "./adminMetrics";

/**
 * Usuários ativos (superadmin): quem fez ao menos um request autenticado no dia (calendário de São
 * Paulo). DAU é o último dia do período; WAU e MAU, os 7 e os 30 dias que terminam nele.
 */

export type AdminActive = {
  dau: number;
  wau: number;
  mau: number;
  series: { day: string; active: number }[];
};

export function getActiveUsers(
  session: SupabaseSession,
  range: MetricsRange,
): Promise<AdminActive> {
  const params = `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
  return apiRequest<AdminActive>(`/api/v1/admin/metrics/active?${params}`, {
    accessToken: session.access_token,
  });
}

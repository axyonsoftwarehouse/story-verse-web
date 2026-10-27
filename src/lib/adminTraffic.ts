import type { SupabaseSession } from "./auth";
import { apiRequest } from "./backend";
import type { MetricsRange } from "./adminMetrics";

/**
 * Tráfego do site (superadmin): a API lê o Umami da VPS no servidor, com a senha só lá. Quando o
 * Umami falha ou não está configurado, a resposta continua 200 com `traffic: null` e o motivo em `error`.
 */

export type TrafficItem = { value: string; count: number };

export type AdminTraffic = {
  from: string;
  to: string;
  traffic: {
    visitors: number;
    pageviews: number;
    visits: number;
    /** Fração de 0 a 1: visitas de uma página só ÷ visitas. */
    bounceRate: number;
    avgVisitSeconds: number;
    activeNow: number;
    previous: { visitors: number; pageviews: number; visits: number };
    series: { day: string; visitors: number; pageviews: number }[];
    topPages: TrafficItem[];
    /** `value` vazio = acesso direto. */
    referrers: TrafficItem[];
    devices: TrafficItem[];
    countries: TrafficItem[];
  } | null;
  error: string | null;
};

export function getTraffic(session: SupabaseSession, range: MetricsRange): Promise<AdminTraffic> {
  const params = `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
  return apiRequest<AdminTraffic>(`/api/v1/admin/traffic?${params}`, {
    accessToken: session.access_token,
  });
}

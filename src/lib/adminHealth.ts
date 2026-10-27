import type { AdminOverview } from "./adminOverview";
import type { SupabaseSession } from "./auth";
import { apiRequest } from "./backend";

/**
 * Saúde do sistema (superadmin): a API lê o Sentry no servidor, com o token só lá. Quando o Sentry
 * falha ou não está configurado, a resposta continua 200 com `sentry: null` e o motivo em `error`.
 */

export type HealthPeriod = "24h" | "7d" | "14d";

export type HealthIssue = {
  id: string;
  title: string;
  count: number;
  users: number;
  lastSeen: string | null;
  permalink: string | null;
};

export type HealthProject = {
  slug: string;
  errorsSeries: { day: string; accepted: number; filtered: number | null }[];
  errorsTotal: number;
  /** Fração de 0 a 1; null em projeto sem sessões. */
  crashFreeSessions: number | null;
  sessionsSeries: { day: string; sessions: number }[];
  topIssues: HealthIssue[];
};

export type AdminHealth = {
  period: HealthPeriod;
  sentry: { projects: HealthProject[] } | null;
  error: string | null;
  backup: AdminOverview["backup"];
};

export function getHealth(session: SupabaseSession, period: HealthPeriod): Promise<AdminHealth> {
  return apiRequest<AdminHealth>(`/api/v1/admin/health?period=${period}`, {
    accessToken: session.access_token,
  });
}

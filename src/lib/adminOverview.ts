import type { SupabaseSession } from "./auth";
import { apiRequest } from "./backend";

export type AdminOverview = {
  moderation: { pendingSubmissions: number; openReports: number } | null;
  accounts: { total: number; newLast7Days: number } | null;
  features: Record<string, number> | null;
  backup: {
    status: string | null;
    finishedAt: string | null;
    sizeBytes: number | null;
    stale: boolean;
  } | null;
};

/**
 * O menu (`AdminRoute`, para o contador de envios) e o painel (`OverviewSection`) pedem a mesma
 * visão geral no mesmo instante. Enquanto a requisição está em voo, os dois compartilham a mesma
 * promessa: uma chamada só. Nada fica em cache depois que ela termina.
 */
let inFlight: { key: string; promise: Promise<AdminOverview> } | null = null;

export function getOverview(session: SupabaseSession): Promise<AdminOverview> {
  const key = session.user?.id ?? session.access_token ?? "";
  if (inFlight && inFlight.key === key) return inFlight.promise;
  const promise = apiRequest<AdminOverview>("/api/v1/admin/overview", {
    accessToken: session.access_token,
  }).finally(() => {
    if (inFlight?.promise === promise) inFlight = null;
  });
  inFlight = { key, promise };
  return promise;
}

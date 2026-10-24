import type { SupabaseSession } from "./auth";
import { apiFetch, apiRequest } from "./backend";

export type AuditEntry = {
  id: number;
  actorId: string | null;
  actorName: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AuditFilters = {
  action?: string;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  from?: string;
  to?: string;
};

export type AuditPage = {
  items: AuditEntry[];
  nextBefore: number | null;
};

function auditParams(filters: AuditFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params;
}

export function listAudit(
  session: SupabaseSession,
  filters: AuditFilters,
  before?: number | null,
): Promise<AuditPage> {
  const params = auditParams(filters);
  if (before) params.set("before", String(before));
  const query = params.toString();
  return apiRequest<AuditPage>(`/api/v1/admin/audit${query ? `?${query}` : ""}`, {
    accessToken: session.access_token,
  });
}

/** Baixa o CSV do per?odo/filtros atuais (o backend limita a 31 dias/50.000 linhas). */
export async function exportAudit(session: SupabaseSession, filters: AuditFilters): Promise<Blob> {
  const query = auditParams(filters).toString();
  const response = await apiFetch(`/api/v1/admin/audit/export?${query}`, {
    accessToken: session.access_token,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(body.error || body.message || "N?o foi poss?vel exportar a auditoria.");
  }
  return response.blob();
}

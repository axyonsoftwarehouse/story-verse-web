import type { SupabaseSession } from "./auth";
import { apiRequest } from "./backend";

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

export function listAudit(
  session: SupabaseSession,
  filters: AuditFilters,
  before?: number | null,
): Promise<AuditPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  if (before) params.set("before", String(before));
  const query = params.toString();
  return apiRequest<AuditPage>(`/api/v1/admin/audit${query ? `?${query}` : ""}`, {
    accessToken: session.access_token,
  });
}

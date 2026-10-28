import type { SupabaseSession } from "./auth";
import { apiRequest } from "./backend";

export type SanctionKind = "warning" | "suspension" | "ban";

export type AdminSanction = {
  id: string;
  userId: string;
  userName: string;
  emailMasked: string;
  kind: SanctionKind;
  reason: string | null;
  expiresAt: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  revokedBy: string | null;
  revokedByName: string | null;
  revokedAt: string | null;
};

export type SanctionPage = {
  items: AdminSanction[];
  nextCursor: string | null;
};

export type SanctionFilters = {
  status?: "active" | "revoked" | "all";
  kind?: SanctionKind | "";
  q?: string;
  cursor?: string;
  limit?: number;
};

export type ApplySanctionInput = {
  kind: SanctionKind;
  reason: string;
  /** ISO-8601; obrigatório em suspension, proibido em ban. */
  expiresAt?: string | null;
};

export function listAccountSanctions(session: SupabaseSession, userId: string): Promise<AdminSanction[]> {
  return apiRequest<AdminSanction[]>(
    `/api/v1/admin/users/${encodeURIComponent(userId)}/sanctions`,
    { accessToken: session.access_token },
  );
}

export function applySanction(
  session: SupabaseSession,
  userId: string,
  input: ApplySanctionInput,
): Promise<AdminSanction> {
  return apiRequest<AdminSanction>(`/api/v1/admin/users/${encodeURIComponent(userId)}/sanctions`, {
    method: "POST",
    accessToken: session.access_token,
    body: input,
  });
}

export function revokeSanction(
  session: SupabaseSession,
  sanctionId: string,
  reason?: string,
): Promise<AdminSanction> {
  return apiRequest<AdminSanction>(`/api/v1/admin/sanctions/${encodeURIComponent(sanctionId)}/revoke`, {
    method: "POST",
    accessToken: session.access_token,
    body: reason?.trim() ? { reason: reason.trim() } : {},
  });
}

export function listSanctions(
  session: SupabaseSession,
  filters: SanctionFilters = {},
): Promise<SanctionPage> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.cursor) params.set("cursor", filters.cursor);
  params.set("limit", String(filters.limit ?? 20));
  return apiRequest<SanctionPage>(`/api/v1/admin/sanctions?${params.toString()}`, {
    accessToken: session.access_token,
  });
}

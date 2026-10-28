import type { AdminSanction } from "./adminSanctions";
import type { SupabaseSession } from "./auth";
import { apiRequest } from "./backend";

export type AdminUserSummary = {
  id: string;
  name: string;
  emailMasked: string;
  emailConfirmed: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  roles: string[];
};

export type AdminUserPage = {
  items: AdminUserSummary[];
  nextCursor: string | null;
};

export type AdminUserFilters = {
  q?: string;
  role?: string;
  feature?: string;
  cursor?: string;
  limit?: number;
};

export type AdminUserDetail = {
  id: string;
  name: string;
  email: string;
  emailConfirmed: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  roles: string[];
  features: string[];
  activeSessions: number;
  recentAudit: Record<string, unknown>[] | null;
  sanctions: AdminSanction[];
};

export type AdminRole = "moderator" | "support";

export function searchUsers(session: SupabaseSession, q: string): Promise<AdminUserSummary[]> {
  return apiRequest<AdminUserSummary[]>(`/api/v1/admin/users?q=${encodeURIComponent(q)}`, {
    accessToken: session.access_token,
  });
}

export function recentUsers(session: SupabaseSession, limit = 20): Promise<AdminUserSummary[]> {
  return apiRequest<AdminUserSummary[]>(`/api/v1/admin/users/recent?limit=${limit}`, {
    accessToken: session.access_token,
  });
}

export function listUsers(session: SupabaseSession, filters: AdminUserFilters = {}): Promise<AdminUserPage> {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.role) params.set("role", filters.role);
  if (filters.feature) params.set("feature", filters.feature);
  if (filters.cursor) params.set("cursor", filters.cursor);
  params.set("limit", String(filters.limit ?? 20));
  return apiRequest<AdminUserPage>(`/api/v1/admin/users/list?${params.toString()}`, {
    accessToken: session.access_token,
  });
}

export function getUser(session: SupabaseSession, id: string): Promise<AdminUserDetail> {
  return apiRequest<AdminUserDetail>(`/api/v1/admin/users/${encodeURIComponent(id)}`, {
    accessToken: session.access_token,
  });
}

export function revokeSessions(
  session: SupabaseSession,
  id: string,
): Promise<{ revoked: number }> {
  return apiRequest<{ revoked: number }>(
    `/api/v1/admin/users/${encodeURIComponent(id)}/sessions/revoke`,
    {
      method: "POST",
      accessToken: session.access_token,
    },
  );
}

export function setRole(
  session: SupabaseSession,
  id: string,
  role: AdminRole,
  on: boolean,
): Promise<{ roles: string[] }> {
  return apiRequest<{ roles: string[] }>(
    `/api/v1/admin/users/${encodeURIComponent(id)}/roles/${encodeURIComponent(role)}`,
    {
      method: on ? "PUT" : "DELETE",
      accessToken: session.access_token,
    },
  );
}

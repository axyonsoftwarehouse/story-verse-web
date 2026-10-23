import type { SupabaseSession } from "./auth";
import { apiRequest } from "./backend";

export type AdminUserSummary = {
  id: string;
  name: string;
  emailMasked: string;
  emailConfirmed: boolean;
  createdAt: string;
  roles: string[];
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
};

export type AdminRole = "moderator" | "support";

export function searchUsers(session: SupabaseSession, q: string): Promise<AdminUserSummary[]> {
  return apiRequest<AdminUserSummary[]>(`/api/v1/admin/users?q=${encodeURIComponent(q)}`, {
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

import type { SupabaseSession } from "./auth";
import { apiRequest } from "./backend";

export function exportAccount(session: SupabaseSession): Promise<Record<string, unknown>> {
  return apiRequest<Record<string, unknown>>("/api/v1/account/export", {
    accessToken: session.access_token,
  });
}

export function deleteAccount(session: SupabaseSession, password: string): Promise<void> {
  return apiRequest<void>("/api/v1/account", {
    method: "DELETE",
    body: { password },
    accessToken: session.access_token,
  });
}

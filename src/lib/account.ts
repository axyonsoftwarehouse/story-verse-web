import type { SupabaseSession } from "./auth";
import { apiFetch, apiRequest } from "./backend";

export function exportAccount(session: SupabaseSession): Promise<Record<string, unknown>> {
  return apiRequest<Record<string, unknown>>("/api/v1/account/export", {
    accessToken: session.access_token,
  });
}

export async function exportAccountFiles(session: SupabaseSession): Promise<Blob> {
  const response = await apiFetch("/api/v1/account/export/files", {
    accessToken: session.access_token,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(payload.error ?? payload.message ?? "Não foi possível exportar seus arquivos.");
  }
  return response.blob();
}

export function deleteAccount(session: SupabaseSession, password: string): Promise<void> {
  return apiRequest<void>("/api/v1/account", {
    method: "DELETE",
    body: { password },
    accessToken: session.access_token,
  });
}

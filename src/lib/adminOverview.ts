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

export function getOverview(session: SupabaseSession): Promise<AdminOverview> {
  return apiRequest<AdminOverview>("/api/v1/admin/overview", {
    accessToken: session.access_token,
  });
}

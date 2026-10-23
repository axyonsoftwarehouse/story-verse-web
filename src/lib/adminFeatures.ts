import type { SupabaseSession } from "./auth";
import { apiRequest } from "./backend";

export type FeatureCatalogEntry = {
  feature: string;
  enabledCount: number;
};

export type FeatureUser = {
  userId: string;
  name: string;
  emailMasked: string;
  grantedByName: string | null;
  updatedAt: string;
};

export type FeatureUsersPage = {
  items: FeatureUser[];
  nextCursor: string | null;
};

export function getCatalog(session: SupabaseSession): Promise<FeatureCatalogEntry[]> {
  return apiRequest<FeatureCatalogEntry[]>("/api/v1/admin/features/catalog", {
    accessToken: session.access_token,
  });
}

export function listFeatureUsers(
  session: SupabaseSession,
  feature: string,
  cursor?: string | null,
): Promise<FeatureUsersPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return apiRequest<FeatureUsersPage>(
    `/api/v1/admin/features/${encodeURIComponent(feature)}/users${query}`,
    { accessToken: session.access_token },
  );
}

export function setFeature(
  session: SupabaseSession,
  userId: string,
  feature: string,
  enabled: boolean,
): Promise<void> {
  return apiRequest<void>("/api/v1/admin/features", {
    method: "PUT",
    accessToken: session.access_token,
    body: { userId, feature, enabled },
  });
}

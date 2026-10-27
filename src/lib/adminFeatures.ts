import type { SupabaseSession } from "./auth";
import { apiRequest } from "./backend";

export type FeatureCatalogEntry = {
  feature: string;
  enabledCount: number;
  /** Ligado para todas as contas pela configuração da API: não se liga nem desliga por conta. */
  everyone?: boolean;
};

/** O que cada recurso em teste faz, para quem não conhece o nome técnico. */
export const FEATURE_DESCRIPTIONS: Record<string, { name: string; description: string }> = {
  library: {
    name: "Estante na conta",
    description:
      "Salva a estante na conta e sincroniza entre aparelhos; libera “adicionar à estante” na página do livro.",
  },
};

export function featureName(feature: string): string {
  return FEATURE_DESCRIPTIONS[feature]?.name ?? feature;
}

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

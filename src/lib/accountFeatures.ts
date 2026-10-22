import type { SupabaseSession } from "./auth";
import { apiEnabled, apiRequest } from "./backend";

export type AccountCapabilities = {
  roles: string[];
  features: string[];
};

/** Capabilities da conta: papéis e features em beta (ex.: `library`). */
export async function fetchAccountCapabilities(session: SupabaseSession): Promise<AccountCapabilities> {
  if (!apiEnabled) return { roles: [], features: [] };
  const result = await apiRequest<Partial<AccountCapabilities>>("/api/v1/auth/capabilities", {
    accessToken: session.access_token,
  });
  return {
    roles: Array.isArray(result.roles) ? result.roles : [],
    features: Array.isArray(result.features) ? result.features : [],
  };
}

export function hasFeature(capabilities: AccountCapabilities | null, feature: string): boolean {
  return capabilities?.features.includes(feature) ?? false;
}

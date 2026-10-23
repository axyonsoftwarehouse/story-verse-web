import type { SupabaseSession } from "./auth";
import { apiEnabled, apiRequest } from "./backend";

export type AccountCapabilities = {
  roles: string[];
  features: string[];
};

const CACHE_PREFIX = "storyverse:capabilities:";

/** Capabilities da conta: papéis e features em beta (ex.: `library`). */
export async function fetchAccountCapabilities(session: SupabaseSession): Promise<AccountCapabilities> {
  if (!apiEnabled) return { roles: [], features: [] };
  const result = await apiRequest<Partial<AccountCapabilities>>("/api/v1/auth/capabilities", {
    accessToken: session.access_token,
  });
  const capabilities = {
    roles: Array.isArray(result.roles) ? result.roles : [],
    features: Array.isArray(result.features) ? result.features : [],
  };
  try {
    localStorage.setItem(CACHE_PREFIX + session.user.id, JSON.stringify(capabilities));
  } catch {
    // Sem armazenamento: offline a conta só não lembra das features.
  }
  return capabilities;
}

/**
 * Última resposta conhecida desta conta neste aparelho. Sem internet, a estante continua ligada
 * (a autorização de verdade é sempre no servidor, que recusa o sync se a feature saiu).
 */
export function cachedAccountCapabilities(userId: string): AccountCapabilities | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_PREFIX + userId) ?? "null") as Partial<AccountCapabilities> | null;
    if (!parsed) return null;
    return {
      roles: Array.isArray(parsed.roles) ? parsed.roles : [],
      features: Array.isArray(parsed.features) ? parsed.features : [],
    };
  } catch {
    return null;
  }
}

export function hasFeature(capabilities: AccountCapabilities | null, feature: string): boolean {
  return capabilities?.features.includes(feature) ?? false;
}

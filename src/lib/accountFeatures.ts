import type { SupabaseSession } from "./auth";
import { apiEnabled, apiRequest } from "./backend";
import type { SubscriptionSnapshot } from "./billing";

export type AccountCapabilities = {
  roles: string[];
  features: string[];
  /** Estado da assinatura (a API devolve junto para a UI não fazer outra chamada). */
  subscription?: SubscriptionSnapshot;
};

const CACHE_PREFIX = "storyverse:capabilities:";

/** Capabilities da conta: papéis e features em beta (ex.: `library`). */
export async function fetchAccountCapabilities(session: SupabaseSession): Promise<AccountCapabilities> {
  if (!apiEnabled) return { roles: [], features: [] };
  const result = await apiRequest<Partial<AccountCapabilities>>("/api/v1/auth/capabilities", {
    accessToken: session.access_token,
  });
  const capabilities: AccountCapabilities = {
    roles: Array.isArray(result.roles) ? result.roles : [],
    features: Array.isArray(result.features) ? result.features : [],
  };
  if (result.subscription && typeof result.subscription === "object") {
    const subscription = result.subscription as SubscriptionSnapshot;
    capabilities.subscription = {
      status: typeof subscription.status === "string" ? subscription.status : "none",
      active: Boolean(subscription.active),
      accessUntil: subscription.accessUntil ?? null,
      plan: subscription.plan ?? "",
      cancelAtPeriodEnd: Boolean(subscription.cancelAtPeriodEnd),
    };
  }
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
      ...(parsed.subscription ? { subscription: parsed.subscription as SubscriptionSnapshot } : {}),
    };
  } catch {
    return null;
  }
}

export function hasFeature(capabilities: AccountCapabilities | null, feature: string): boolean {
  return capabilities?.features.includes(feature) ?? false;
}

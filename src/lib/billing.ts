import { refreshAuthSession, type SupabaseSession } from "./auth";
import { apiRequest, AuthSessionError } from "./backend";

/** Assinatura mensal: o servidor decide o acesso; aqui só lemos e abrimos Stripe/Portal. */

/** Liga a UI do paywall. Precisa acompanhar `BILLING_ENABLED` na API. */
export const BILLING_UI_ENABLED = import.meta.env.VITE_BILLING_ENABLED === "true";

export type SubscriptionSnapshot = {
  status: string;
  active: boolean;
  accessUntil: string | null;
  plan: string;
  cancelAtPeriodEnd: boolean;
  /** Por que tem acesso (pix, grant, staff, trial, active…); `status` é só o da assinatura no cartão. */
  reason?: string;
};

export type SubscriptionStatus = SubscriptionSnapshot & {
  priceId?: string;
  currency?: string;
  interval?: string;
  trialDays?: number;
  trialEnd?: string | null;
  portalAvailable?: boolean;
  /** Pix pré-pago: cada pagamento libera `pixDays` dias; não renova sozinho. */
  pixAvailable?: boolean;
  pixDays?: number;
  prepaid?: { accessUntil: string | null; lastPaidAt: string | null } | null;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  priceLabel: string;
  currency: string;
  interval: string;
  trialDays: number;
};

export type PlansResponse = {
  plans: SubscriptionPlan[];
};

export function fetchBillingPlans(): Promise<PlansResponse> {
  return apiRequest<PlansResponse>("/api/v1/billing/plans");
}

/**
 * Token de acesso velho (outra aba ou o link de confirmação renovou a sessão e esta tela ficou com o
 * anterior): renova pelo cookie uma vez e repete. Sem isso a conta nova via "Sessão inválida." no checkout.
 */
async function withFreshSession<T>(
  session: SupabaseSession,
  call: (accessToken: string) => Promise<T>,
): Promise<T> {
  try {
    return await call(session.access_token);
  } catch (error) {
    if (!(error instanceof AuthSessionError)) throw error;
    const fresh = await refreshAuthSession(true);
    return call(fresh.access_token);
  }
}

export function fetchBillingStatus(session: SupabaseSession): Promise<SubscriptionStatus> {
  return withFreshSession(session, (accessToken) =>
    apiRequest<SubscriptionStatus>("/api/v1/billing/status", { accessToken }),
  );
}

export function startBillingCheckout(
  session: SupabaseSession,
): Promise<{ url: string }> {
  return withFreshSession(session, (accessToken) =>
    apiRequest<{ url: string }>("/api/v1/billing/checkout", { method: "POST", accessToken }),
  );
}

/** Checkout avulso só com Pix (QR code no Stripe). */
export function startPixCheckout(session: SupabaseSession): Promise<{ url: string }> {
  return withFreshSession(session, (accessToken) =>
    apiRequest<{ url: string }>("/api/v1/billing/pix-checkout", { method: "POST", accessToken }),
  );
}

export function openBillingPortal(session: SupabaseSession): Promise<{ url: string }> {
  return withFreshSession(session, (accessToken) =>
    apiRequest<{ url: string }>("/api/v1/billing/portal", { method: "POST", accessToken }),
  );
}

const STATUS_LABELS: Record<string, string> = {
  none: "Sem assinatura",
  trialing: "Em teste grátis",
  active: "Assinatura ativa",
  past_due: "Pagamento pendente",
  canceled: "Cancelada",
  unpaid: "Não paga",
  incomplete: "Checkout não concluído",
  incomplete_expired: "Checkout expirado",
  paused: "Pausada",
  grant: "Acesso liberado",
  pix: "Pago com Pix",
  staff: "Equipe",
  disabled: "Assinatura desligada",
};

export function billingStatusLabel(status: string | undefined): string {
  return status ? (STATUS_LABELS[status] ?? status) : "Sem assinatura";
}

export function billingDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function billingTone(status: string | undefined): string {
  if (status === "active" || status === "trialing" || status === "grant" || status === "staff") {
    return "is-approved";
  }
  if (status === "past_due") return "is-pending";
  if (status === "none" || status === "disabled") return "";
  return "is-archived";
}

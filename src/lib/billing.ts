import type { SupabaseSession } from "./auth";
import { apiRequest } from "./backend";

/** Assinatura mensal: o servidor decide o acesso; aqui só lemos e abrimos Stripe/Portal. */

/** Liga a UI do paywall. Precisa acompanhar `BILLING_ENABLED` na API. */
export const BILLING_UI_ENABLED = import.meta.env.VITE_BILLING_ENABLED === "true";

export type SubscriptionSnapshot = {
  status: string;
  active: boolean;
  accessUntil: string | null;
  plan: string;
  cancelAtPeriodEnd: boolean;
};

export type SubscriptionStatus = SubscriptionSnapshot & {
  reason?: string;
  priceId?: string;
  currency?: string;
  interval?: string;
  trialDays?: number;
  trialEnd?: string | null;
  portalAvailable?: boolean;
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

export function fetchBillingStatus(session: SupabaseSession): Promise<SubscriptionStatus> {
  return apiRequest<SubscriptionStatus>("/api/v1/billing/status", {
    accessToken: session.access_token,
  });
}

export function startBillingCheckout(
  session: SupabaseSession,
): Promise<{ url: string }> {
  return apiRequest<{ url: string }>("/api/v1/billing/checkout", {
    method: "POST",
    accessToken: session.access_token,
  });
}

export function openBillingPortal(session: SupabaseSession): Promise<{ url: string }> {
  return apiRequest<{ url: string }>("/api/v1/billing/portal", {
    method: "POST",
    accessToken: session.access_token,
  });
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

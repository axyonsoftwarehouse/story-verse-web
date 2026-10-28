import type { SupabaseSession } from "./auth";
import { apiRequest } from "./backend";

/** Financeiro somente leitura do admin (superadmin). */
export type BillingSummary = {
  active: number;
  trialing: number;
  past_due: number;
  canceled: number;
  new_count: number;
  canceled_count: number;
  failed: number;
  mrr_cents: number;
  /** Conversão de teste em pago (API a partir da V23); taxa = convertidos ÷ encerrados. */
  trials_started?: number;
  trials_ended?: number;
  trials_converted?: number;
  from: string;
  to: string;
};

export type AdminBillingSubscription = {
  id: string;
  user_id: string;
  emailMasked: string;
  stripe_subscription_id: string;
  stripe_price_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_end: string | null;
  canceled_at: string | null;
  latest_invoice_status: string | null;
  amount_cents: number | null;
  currency: string | null;
  updated_at: string;
};

export function getBillingSummary(
  session: SupabaseSession,
  params: { from?: string; to?: string } = {},
): Promise<BillingSummary> {
  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<BillingSummary>(`/api/v1/admin/billing/summary${suffix}`, {
    accessToken: session.access_token,
  });
}

/** Um ponto da série do financeiro; `estimated` = MRR reconstruído, sem snapshot daquele dia. */
export type BillingSeriesPoint = {
  bucket: string;
  mrrCents: number;
  active: number;
  newCount: number;
  canceledCount: number;
  revenueCents: number;
  estimated: boolean;
};

export function getBillingSeries(
  session: SupabaseSession,
  range: { from: string; to: string },
  group: "day" | "week" = "day",
): Promise<BillingSeriesPoint[]> {
  const query = new URLSearchParams({ from: range.from, to: range.to, group });
  return apiRequest<BillingSeriesPoint[]>(`/api/v1/admin/billing/series?${query.toString()}`, {
    accessToken: session.access_token,
  });
}

export function listBillingSubscriptions(
  session: SupabaseSession,
  params: { status?: string; q?: string } = {},
): Promise<AdminBillingSubscription[]> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.q?.trim()) query.set("q", params.q.trim());
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<AdminBillingSubscription[]>(`/api/v1/admin/billing/subscriptions${suffix}`, {
    accessToken: session.access_token,
  });
}

export function getBillingSubscription(
  session: SupabaseSession,
  id: string,
): Promise<AdminBillingSubscription> {
  return apiRequest<AdminBillingSubscription>(
    `/api/v1/admin/billing/subscriptions/${encodeURIComponent(id)}`,
    { accessToken: session.access_token },
  );
}

export function brlFromCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Acesso grátis manual (família, testes, fundadores). Nunca gera cobrança. Só superadmin. */
export type BillingGrant = {
  id: string;
  reason: string;
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
  created_by_name: string | null;
  revoked_by_name: string | null;
  active: boolean;
};

export function listBillingGrants(session: SupabaseSession, userId: string): Promise<BillingGrant[]> {
  return apiRequest<BillingGrant[]>(
    `/api/v1/admin/billing/grants?userId=${encodeURIComponent(userId)}`,
    { accessToken: session.access_token },
  );
}

export function createBillingGrant(
  session: SupabaseSession,
  input: { userId: string; reason: string; expiresAt: string | null },
): Promise<BillingGrant> {
  return apiRequest<BillingGrant>("/api/v1/admin/billing/grants", {
    method: "POST",
    body: input,
    accessToken: session.access_token,
  });
}

export function revokeBillingGrant(session: SupabaseSession, id: string): Promise<void> {
  return apiRequest<void>(`/api/v1/admin/billing/grants/${encodeURIComponent(id)}`, {
    method: "DELETE",
    accessToken: session.access_token,
  });
}

/** Validade a partir do preset em dias; vazio = sem prazo. */
export function grantExpiresAt(preset: string, now = Date.now()): string | null {
  const days = Number(preset);
  return preset && days > 0 ? new Date(now + days * 86_400_000).toISOString() : null;
}

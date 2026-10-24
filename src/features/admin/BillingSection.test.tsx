import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import {
  getBillingSubscription,
  getBillingSummary,
  listBillingSubscriptions,
  type AdminBillingSubscription,
} from "../../lib/adminBilling";
import { BillingSection } from "./BillingSection";

vi.mock("../../lib/adminBilling", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/adminBilling")>();
  return {
    ...actual,
    getBillingSummary: vi.fn(),
    listBillingSubscriptions: vi.fn(),
    getBillingSubscription: vi.fn(),
  };
});

const session = { access_token: "token" } as SupabaseSession;

const row: AdminBillingSubscription = {
  id: "s1",
  user_id: "u1",
  emailMasked: "le***@example.com",
  stripe_subscription_id: "sub_123",
  stripe_price_id: "price_123",
  status: "active",
  current_period_start: "2026-10-01T00:00:00Z",
  current_period_end: "2026-11-01T00:00:00Z",
  cancel_at_period_end: false,
  trial_end: null,
  canceled_at: null,
  latest_invoice_status: "paid",
  amount_cents: 990,
  currency: "brl",
  updated_at: "2026-10-24T00:00:00Z",
};

describe("BillingSection", () => {
  beforeEach(() => {
    vi.mocked(getBillingSummary).mockResolvedValue({
      active: 3,
      trialing: 1,
      past_due: 0,
      canceled: 1,
      new_count: 2,
      canceled_count: 1,
      failed: 0,
      mrr_cents: 2970,
      from: "2026-09-24T00:00:00Z",
      to: "2026-10-24T00:00:00Z",
    });
    vi.mocked(listBillingSubscriptions).mockResolvedValue([row]);
    vi.mocked(getBillingSubscription).mockResolvedValue(row);
  });

  it("mostra MRR, assinantes e detalhe", async () => {
    render(<BillingSection session={session} />);
    expect(await screen.findByText(/R\$\s*29,70/)).toBeInTheDocument();
    expect(screen.getByText("le***@example.com")).toBeInTheDocument();
    expect(screen.getByText("Assinatura ativa")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    expect(await screen.findByText("sub_123")).toBeInTheDocument();
  });
});

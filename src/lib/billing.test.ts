import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "./auth";
import { apiRequest } from "./backend";
import {
  billingStatusLabel,
  fetchBillingPlans,
  fetchBillingStatus,
  openBillingPortal,
  startBillingCheckout,
} from "./billing";

vi.mock("./backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./backend")>();
  return { ...actual, apiRequest: vi.fn() };
});

const session = { access_token: "token" } as SupabaseSession;

describe("billing", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it("lê o plano público", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ plans: [{ id: "storyverse" }] });
    await fetchBillingPlans();
    expect(vi.mocked(apiRequest).mock.calls[0][0]).toBe("/api/v1/billing/plans");
  });

  it("consulta o status com a sessão", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ status: "active" });
    await fetchBillingStatus(session);
    expect(vi.mocked(apiRequest).mock.calls[0]).toEqual([
      "/api/v1/billing/status",
      { accessToken: "token" },
    ]);
  });

  it("abre checkout e portal com POST", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ url: "https://stripe.test" });
    await startBillingCheckout(session);
    await openBillingPortal(session);
    expect(vi.mocked(apiRequest).mock.calls[0][0]).toBe("/api/v1/billing/checkout");
    expect(vi.mocked(apiRequest).mock.calls[0][1]?.method).toBe("POST");
    expect(vi.mocked(apiRequest).mock.calls[1][0]).toBe("/api/v1/billing/portal");
    expect(vi.mocked(apiRequest).mock.calls[1][1]?.method).toBe("POST");
  });

  it("tem rótulo para os estados", () => {
    expect(billingStatusLabel("trialing")).toBe("Em teste grátis");
    expect(billingStatusLabel("past_due")).toBe("Pagamento pendente");
  });
});

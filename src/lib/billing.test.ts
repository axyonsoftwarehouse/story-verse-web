import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshAuthSession, type SupabaseSession } from "./auth";
import { apiRequest, AuthSessionError } from "./backend";
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

vi.mock("./auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auth")>();
  return { ...actual, refreshAuthSession: vi.fn() };
});

const session = { access_token: "token" } as SupabaseSession;

describe("billing", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
    vi.mocked(refreshAuthSession).mockReset();
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

  it("token velho: renova a sessão uma vez e repete o checkout", async () => {
    vi.mocked(apiRequest)
      .mockRejectedValueOnce(new AuthSessionError("Sessão inválida."))
      .mockResolvedValueOnce({ url: "https://stripe.test" });
    vi.mocked(refreshAuthSession).mockResolvedValue({ access_token: "novo" } as SupabaseSession);

    await expect(startBillingCheckout(session)).resolves.toEqual({ url: "https://stripe.test" });
    expect(refreshAuthSession).toHaveBeenCalledWith(true);
    expect(vi.mocked(apiRequest).mock.calls[1][1]?.accessToken).toBe("novo");
  });

  it("outros erros não renovam a sessão", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error("Falha na requisição."));
    await expect(openBillingPortal(session)).rejects.toThrow("Falha na requisição.");
    expect(refreshAuthSession).not.toHaveBeenCalled();
  });

  it("sessão encerrada de verdade continua dando erro", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new AuthSessionError("Sessão inválida."));
    vi.mocked(refreshAuthSession).mockRejectedValue(new AuthSessionError("Sessão expirada. Entre novamente."));
    await expect(fetchBillingStatus(session)).rejects.toThrow("Sessão expirada. Entre novamente.");
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it("tem rótulo para os estados", () => {
    expect(billingStatusLabel("trialing")).toBe("Em teste grátis");
    expect(billingStatusLabel("past_due")).toBe("Pagamento pendente");
  });
});

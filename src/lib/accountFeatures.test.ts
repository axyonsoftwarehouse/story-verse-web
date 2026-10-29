import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = {
  access_token: "token-123",
  refresh_token: "",
  expires_at: 9999999999,
  user: { id: "user-1", email: "user@example.test" },
};

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_API_URL", "https://api.example.test");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("account features", () => {
  it("lê features das capabilities e expõe hasFeature", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ roles: ["moderator"], features: ["library"] })),
      ),
    );
    const { fetchAccountCapabilities, hasFeature } = await import("./accountFeatures");
    const capabilities = await fetchAccountCapabilities(session);
    expect(capabilities.features).toEqual(["library"]);
    expect(hasFeature(capabilities, "library")).toBe(true);
    expect(hasFeature(capabilities, "outra")).toBe(false);
    expect(hasFeature(null, "library")).toBe(false);
  });

  it("guarda o motivo do acesso da assinatura", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            roles: [],
            features: [],
            subscription: { status: "none", active: true, reason: "pix", accessUntil: "2026-12-04T00:00:00Z", plan: "R$ 9,90" },
          }),
        ),
      ),
    );
    const { fetchAccountCapabilities } = await import("./accountFeatures");
    const capabilities = await fetchAccountCapabilities(session);
    expect(capabilities.subscription?.reason).toBe("pix");
    expect(capabilities.subscription?.accessUntil).toBe("2026-12-04T00:00:00Z");
  });
});

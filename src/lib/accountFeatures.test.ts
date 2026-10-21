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
});

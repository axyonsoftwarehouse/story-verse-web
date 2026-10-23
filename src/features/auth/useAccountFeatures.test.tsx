import { renderHook, waitFor } from "@testing-library/react";
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
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("capabilities sem internet", () => {
  it("falha de rede mantém a última capability conhecida da conta", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ roles: [], features: ["library"] }))));
    const { useAccountFeatures } = await import("./useAccountFeatures");
    const first = renderHook(() => useAccountFeatures(session));
    await waitFor(() => expect(first.result.current.capabilities?.features).toEqual(["library"]));
    first.unmount();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const offline = renderHook(() => useAccountFeatures({ ...session, access_token: "token-456" }));
    await waitFor(() => expect(offline.result.current.loading).toBe(false));
    expect(offline.result.current.capabilities?.features).toEqual(["library"]);
  });

  it("o que uma conta tem não vale para outra", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ roles: [], features: ["library"] }))));
    const { useAccountFeatures } = await import("./useAccountFeatures");
    const a = renderHook(() => useAccountFeatures(session));
    await waitFor(() => expect(a.result.current.capabilities?.features).toEqual(["library"]));
    a.unmount();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const b = renderHook(() => useAccountFeatures({ ...session, user: { id: "user-2", email: "b@example.test" } }));
    await waitFor(() => expect(b.result.current.loading).toBe(false));
    expect(b.result.current.capabilities?.features).toEqual([]);
  });
});

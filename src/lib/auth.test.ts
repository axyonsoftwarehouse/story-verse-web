import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "storyverse:supabase-session";
beforeEach(() => { localStorage.clear(); vi.resetModules(); vi.stubEnv("VITE_API_URL", "https://api.example.test"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const old = { access_token: "old-access", refresh_token: "old-refresh", expires_at: 1, user: { id: "A", email: "a@example.test" } };
const refreshed = { accessToken: "new-access", refreshToken: "new-refresh", expiresIn: 1800, user: { id: "A", email: "a@example.test" } };

describe("session refresh races", () => {
  it("serializes concurrent refreshes and reuses the first result", async () => {
    localStorage.setItem(KEY, JSON.stringify(old));
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(refreshed)));
    vi.stubGlobal("fetch", fetch);
    const { refreshAuthSession } = await import("./auth");
    const sessions = await Promise.all([refreshAuthSession(old.refresh_token), refreshAuthSession(old.refresh_token)]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(sessions.map((s) => s.refresh_token)).toEqual(["new-refresh", "new-refresh"]);
  });
  it("a response arriving after logout cannot restore the session", async () => {
    localStorage.setItem(KEY, JSON.stringify(old));
    let release!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { release = resolve; })));
    const { refreshAuthSession, storedAuthSession } = await import("./auth");
    const refresh = refreshAuthSession(old.refresh_token);
    await vi.waitFor(() => expect(release).toBeDefined());
    localStorage.removeItem(KEY);
    release(new Response(JSON.stringify(refreshed)));
    await expect(refresh).rejects.toThrow();
    expect(storedAuthSession()).toBeNull();
  });
});

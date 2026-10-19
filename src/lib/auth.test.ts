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
    const { refreshAuthSession, storedAuthSession, AuthSessionError } = await import("./auth");
    const refresh = refreshAuthSession(old.refresh_token);
    await vi.waitFor(() => expect(release).toBeDefined());
    localStorage.removeItem(KEY);
    release(new Response(JSON.stringify(refreshed)));
    await expect(refresh).rejects.toBeInstanceOf(AuthSessionError);
    expect(storedAuthSession()).toBeNull();
  });
  it("another tab rotating the token wins over the in-flight refresh", async () => {
    localStorage.setItem(KEY, JSON.stringify(old));
    let release!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { release = resolve; })));
    const { refreshAuthSession, storedAuthSession, AuthSessionError } = await import("./auth");
    const refresh = refreshAuthSession(old.refresh_token);
    await vi.waitFor(() => expect(release).toBeDefined());
    // A outra aba já renovou: o token guardado é outro.
    localStorage.setItem(KEY, JSON.stringify({ ...old, refresh_token: "other-refresh" }));
    release(new Response(JSON.stringify(refreshed)));
    await expect(refresh).rejects.toBeInstanceOf(AuthSessionError);
    expect(storedAuthSession()?.refresh_token).toBe("other-refresh");
  });
});

describe("API account flows", () => {
  it("keeps the user signed out until the e-mail is confirmed", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Confirme seu e-mail." }), { status: 202 }));
    vi.stubGlobal("fetch", fetch);
    const { signUpWithPassword, storedAuthSession } = await import("./auth");
    expect(await signUpWithPassword("a@example.test", "secret1", "A")).toBeNull();
    expect(storedAuthSession()).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.test/api/v1/auth/signup",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("confirms an e-mail link and stores the returned session", async () => {
    window.history.replaceState(null, "", "/confirmar-email?token=confirm-token");
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          accessToken: "access",
          refreshToken: "refresh",
          expiresIn: 1800,
          user: { id: "A", email: "a@example.test", user_metadata: { name: "A" } },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const { consumeAuthRedirect, storedAuthSession } = await import("./auth");
    const result = await consumeAuthRedirect();
    expect(result && "session" in result ? result.session.access_token : null).toBe("access");
    expect(storedAuthSession()?.access_token).toBe("access");
    expect(window.location.pathname).toBe("/");
  });

  it("returns the reset token without creating a session", async () => {
    window.history.replaceState(null, "", "/redefinir-senha?token=reset-token");
    const { consumeAuthRedirect, storedAuthSession } = await import("./auth");
    expect(await consumeAuthRedirect()).toEqual({ resetToken: "reset-token", type: "recovery" });
    expect(storedAuthSession()).toBeNull();
    expect(window.location.pathname).toBe("/");
  });

  it("sends the current password when changing it", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    const { updatePassword } = await import("./auth");
    await updatePassword(old, "current-secret", "new-secret");
    const body = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(body).toEqual({ currentPassword: "current-secret", newPassword: "new-secret" });
  });

  it("resets a password using the token", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    const { resetPasswordWithToken } = await import("./auth");
    await resetPasswordWithToken("reset-token", "new-secret");
    const body = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(body).toEqual({ token: "reset-token", password: "new-secret" });
  });
});

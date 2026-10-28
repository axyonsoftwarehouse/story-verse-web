import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  vi.stubEnv("VITE_API_URL", "https://api.example.test");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const user = { id: "A", email: "a@example.test" };
const old = {
  access_token: "old-access",
  refresh_token: "",
  expires_at: 1,
  user,
};
const refreshed = { accessToken: "new-access", expiresIn: 1800, user };
const SESSION_META = "storyverse:session-meta";

describe("restoring the session on open", () => {
  it("does not call the API when this browser never signed in", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { restoreAuthSession } = await import("./auth");

    await expect(restoreAuthSession()).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("renews through the cookie when a signed-in user is remembered", async () => {
    localStorage.setItem(SESSION_META, JSON.stringify({ user, expires_at: 1 }));
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(refreshed)));
    vi.stubGlobal("fetch", fetch);
    const { restoreAuthSession } = await import("./auth");

    await expect(restoreAuthSession()).resolves.toMatchObject({ access_token: "new-access" });
    expect(String(fetch.mock.calls[0][0])).toContain("/api/v1/auth/refresh");
  });

  it("still tries the cookie when storage cannot be read", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(refreshed)));
    vi.stubGlobal("fetch", fetch);
    const { restoreAuthSession } = await import("./auth");

    await expect(restoreAuthSession()).resolves.toMatchObject({ access_token: "new-access" });
    vi.restoreAllMocks();
  });
});

describe("session refresh races", () => {
  beforeEach(() => {
    localStorage.setItem(SESSION_META, JSON.stringify({ user, expires_at: 1 }));
  });

  it("serializes concurrent restores and reuses the first result", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(refreshed)));
    vi.stubGlobal("fetch", fetch);
    const { restoreAuthSession } = await import("./auth");

    const sessions = await Promise.all([restoreAuthSession(), restoreAuthSession()]);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(sessions.map((s) => s?.access_token)).toEqual(["new-access", "new-access"]);
  });

  it("a response arriving after logout cannot restore the session", async () => {
    let release!: (response: Response) => void;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes("/auth/logout")) return Promise.resolve(new Response(null, { status: 204 }));
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
    });
    vi.stubGlobal("fetch", fetch);
    const { restoreAuthSession, signOut, storedAuthSession } = await import("./auth");

    const refresh = restoreAuthSession();
    await vi.waitFor(() => expect(release).toBeDefined());
    await signOut(old);
    release(new Response(JSON.stringify(refreshed)));

    await expect(refresh).resolves.toBeNull();
    expect(storedAuthSession()).toBeNull();
  });

  it("another tab rotating the token wins over the in-flight refresh", async () => {
    let release!: (response: Response) => void;
    const fetch = vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes("/auth/login")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ accessToken: "other-access", expiresIn: 1800, user: { ...user, id: "B" } }),
          ),
        );
      }
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
    });
    vi.stubGlobal("fetch", fetch);
    const { restoreAuthSession, signInWithPassword, storedAuthSession } = await import("./auth");

    const refresh = restoreAuthSession();
    await vi.waitFor(() => expect(release).toBeDefined());
    await signInWithPassword("b@example.test", "secret1");
    release(new Response(JSON.stringify(refreshed)));

    await expect(refresh).resolves.toMatchObject({ access_token: "other-access" });
    expect(storedAuthSession()?.access_token).toBe("other-access");
  });
});

describe("API account flows", () => {
  it("never persists the refresh token and ignores a leaked JSON field", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          accessToken: "access",
          refreshToken: "should-not-be-stored",
          expiresIn: 1800,
          user,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const { signInWithPassword, storedAuthSession } = await import("./auth");

    const session = await signInWithPassword("a@example.test", "secret1");

    expect(session.access_token).toBe("access");
    expect(session.refresh_token).toBe("");
    expect(storedAuthSession()?.refresh_token).toBe("");
    expect(localStorage.getItem("storyverse:supabase-session")).toBeNull();
    expect(JSON.stringify(localStorage)).not.toContain("should-not-be-stored");
    expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: "include" });
  });

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

  it("confirms an e-mail link and stores the returned access token", async () => {
    window.history.replaceState(null, "", "/confirmar-email#token=confirm-token");
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          accessToken: "access",
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
    expect(storedAuthSession()?.refresh_token).toBe("");
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

  it("checks a valid reset link without spending it", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    const { validateResetToken } = await import("./auth");
    await expect(validateResetToken("reset-token")).resolves.toBe(true);
    expect(String(fetch.mock.calls[0][0])).toContain("/api/v1/auth/reset-password/validate");
    expect(fetch.mock.calls[0][1]?.method).toBe("POST");
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ token: "reset-token" });
  });

  it("reports an expired or already used reset link", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Link inválido ou expirado." }), { status: 400 }),
    );
    vi.stubGlobal("fetch", fetch);
    const { validateResetToken } = await import("./auth");
    await expect(validateResetToken("reset-token")).resolves.toBe(false);
  });

  it("does not block the form when the API cannot check the link", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetch);
    const { validateResetToken } = await import("./auth");
    await expect(validateResetToken("reset-token")).resolves.toBe(true);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(validateResetToken("reset-token")).resolves.toBe(true);
  });
});

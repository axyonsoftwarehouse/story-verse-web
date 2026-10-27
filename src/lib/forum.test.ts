import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_API_URL", "https://api.example.test");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const session = {
  access_token: "token-123",
  refresh_token: "refresh-123",
  expires_at: 9999999999,
  user: { id: "user-1", email: "user@example.test" },
};

describe("forum api", () => {
  it("monta os filtros e envia o token", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ items: [], nextCursor: null })));
    vi.stubGlobal("fetch", fetch);

    const { listTopics } = await import("./forum");
    await listTopics(session, { space: "duvidas", filter: "unanswered", q: "ler melhor", limit: 10 });

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/forum/topics?");
    expect(url).toContain("space=duvidas");
    expect(url).toContain("filter=unanswered");
    expect(url).toContain("q=ler+melhor");
    expect(init.headers).toMatchObject({ Authorization: "Bearer token-123" });
  });

  it("não envia Authorization na leitura anônima", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ items: [], nextCursor: null })));
    vi.stubGlobal("fetch", fetch);

    const { listTopics } = await import("./forum");
    await listTopics(null, {});

    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("formata a data do fórum", async () => {
    const { forumDate } = await import("./forum");
    expect(forumDate("2026-10-19T12:00:00Z")).toContain("2026");
  });

  it("junta páginas sem repetir id", async () => {
    const { mergeById } = await import("./forum");
    const merged = mergeById(
      [{ id: "a" }, { id: "b" }],
      [{ id: "b" }, { id: "c" }],
    );
    expect(merged.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });
});

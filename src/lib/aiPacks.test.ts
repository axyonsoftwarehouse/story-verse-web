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

describe("pacotes de mensagens", () => {
  it("compra o pacote com referência idempotente", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          { diamond_balance: 70, credits_balance: 20, messages: 20, duplicate: false },
        ]),
      ),
    );
    vi.stubGlobal("fetch", fetch);

    const { buyAiPack } = await import("./aiPacks");
    const result = await buyAiPack(session, "msg20", "ref-12345678");

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/rpc/buy_ai_pack");
    expect(JSON.parse(String(init.body))).toMatchObject({
      p_pack: "msg20",
      p_ref: "ref-12345678",
    });
    expect(result.credits_balance).toBe(20);
  });

  it("lista o catálogo de pacotes", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: "msg20", name: "Pacote de 20", messages: 20, price: 30 }])),
    );
    vi.stubGlobal("fetch", fetch);

    const { fetchAiPacks } = await import("./aiPacks");
    const packs = await fetchAiPacks(session);

    expect(packs).toEqual([{ id: "msg20", name: "Pacote de 20", messages: 20, price: 30 }]);
  });
});

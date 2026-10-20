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

describe("presentes", () => {
  it("envia o presente com a referência idempotente", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          { balance: 95, daily_limit: 5, remaining_today: 4, week_count: 1, duplicate: false },
        ]),
      ),
    );
    vi.stubGlobal("fetch", fetch);

    const { sendGift } = await import("./gifts");
    const result = await sendGift(session, "user-2", "flor", "ref-12345678");

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/rpc/send_gift");
    expect(JSON.parse(String(init.body))).toMatchObject({
      p_to: "user-2",
      p_gift: "flor",
      p_ref: "ref-12345678",
    });
    expect(result.balance).toBe(95);
  });

  it("transforma a lista semanal em um mapa por leitor", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          { user_id: "user-2", gifts_received: 3 },
          { user_id: "user-3", gifts_received: 1 },
        ]),
      ),
    );
    vi.stubGlobal("fetch", fetch);

    const { fetchWeeklyGiftCounts } = await import("./gifts");
    const counts = await fetchWeeklyGiftCounts(session, 0);

    expect(counts).toEqual({ "user-2": 3, "user-3": 1 });
  });
});

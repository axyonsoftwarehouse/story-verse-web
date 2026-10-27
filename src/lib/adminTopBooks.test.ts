import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "./auth";
import { apiRequest } from "./backend";
import { getTopBooks } from "./adminTopBooks";

vi.mock("./backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./backend")>();
  return { ...actual, apiRequest: vi.fn() };
});

const session = { access_token: "token", user: { id: "admin-1" } } as unknown as SupabaseSession;

describe("adminTopBooks", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it("pede o ranking do período com o limite", async () => {
    const books = [
      { bookKey: "gb:1", title: "Dom Casmurro", author: null, readers: 3, finished: 1 },
    ];
    vi.mocked(apiRequest).mockResolvedValue(books);
    await expect(
      getTopBooks(session, { from: "2026-10-01", to: "2026-10-27" }, 5),
    ).resolves.toEqual(books);
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/admin/metrics/top-books?from=2026-10-01&to=2026-10-27&limit=5",
      { accessToken: "token" },
    );
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Ebook } from "../data/types";

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

describe("estante: chave e datas", () => {
  it("chave do livro para as quatro origens", async () => {
    const { bookKeyOf, shelfSourceOf } = await import("./library");
    expect(bookKeyOf({ id: "gb-1342", gutenbergId: 1342, source: "gutenberg" } as Ebook)).toBe("gb:1342");
    expect(bookKeyOf({ id: "gb-55752", gutenbergId: 55752 } as Ebook)).toBe("gb:55752");
    expect(bookKeyOf({ id: "cm-0f8fad5b-d9cb-469f-a165-70867728950e", source: "community" } as Ebook)).toBe(
      "cm:0f8fad5b-d9cb-469f-a165-70867728950e",
    );
    const catalog = {
      id: "cat-0f8fad5b-d9cb-469f-a165-70867728950e",
      gutenbergId: 1,
      source: "catalog",
      catalogKey: "cat:0f8fad5b-d9cb-469f-a165-70867728950e",
    } as Ebook;
    expect(bookKeyOf(catalog)).toBe("cat:0f8fad5b-d9cb-469f-a165-70867728950e");
    expect(bookKeyOf({ id: catalog.id, gutenbergId: 1 } as Ebook)).toBe(
      "cat:0f8fad5b-d9cb-469f-a165-70867728950e",
    );
    expect(shelfSourceOf(catalog)).toBe("catalog");
    expect(bookKeyOf({ id: "x", gutenbergId: -1729630000000123, source: "local" } as Ebook)).toBe("local:-1729630000000123");
    expect(bookKeyOf({ id: "estranho", gutenbergId: 0 } as Ebook)).toBeNull();
  });

  it("hoje é a data de São Paulo", async () => {
    const { todayInBrazil } = await import("./library");
    expect(todayInBrazil(new Date("2026-10-23T02:30:00Z"))).toBe("2026-10-22");
    expect(todayInBrazil(new Date("2026-10-23T03:30:00Z"))).toBe("2026-10-23");
  });
});

describe("estante: cliente da API", () => {
  it("409 vira ShelfConflictError com a entrada atual", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: "A entrada mudou em outro aparelho.", code: "CONFLICT", current: { bookKey: "gb:1", version: 3 } }),
          { status: 409 },
        ),
      ),
    );
    const { patchShelfEntry, ShelfConflictError } = await import("./library");
    const err = await patchShelfEntry(session, "gb:1", { progressPercent: 10, baseUpdatedAt: "x" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ShelfConflictError);
    expect((err as InstanceType<typeof ShelfConflictError>).current?.version).toBe(3);
  });

  it("outros 4xx seguem como Error com a mensagem do servidor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Nota inválida." }), { status: 422 })),
    );
    const { patchShelfEntry } = await import("./library");
    const { ApiHttpError } = await import("./backend");
    const err = await patchShelfEntry(session, "gb:1", { rating: 4.3, baseUpdatedAt: "x" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiHttpError);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("Nota inválida.");
    expect((err as InstanceType<typeof ApiHttpError>).status).toBe(422);
  });

  it("a chave vai codificada na URL", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ bookKey: "local:-5" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const { putShelfEntry } = await import("./library");
    await putShelfEntry(session, "local:-5", { source: "local", status: "reading", title: "T", baseUpdatedAt: null });
    expect(fetchSpy.mock.calls[0][0]).toBe("https://api.example.test/api/v1/me/library/local%3A-5");
    expect(fetchSpy.mock.calls[0][1].method).toBe("PUT");
  });
});

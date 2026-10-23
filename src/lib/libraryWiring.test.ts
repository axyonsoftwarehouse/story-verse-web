import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Ebook } from "../data/types";

const session = {
  access_token: "token-123",
  refresh_token: "",
  expires_at: 9999999999,
  user: { id: "user-1", email: "user@example.test" },
};
const dom = { id: "gb-55752", gutenbergId: 55752, title: "Dom Casmurro", author: "Machado de Assis", textLanguage: "pt" } as Ebook;

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_API_URL", "https://api.example.test");
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("ligar a estante", () => {
  it("sem a capability não migra, não sincroniza e não chama a API", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { connectShelf } = await import("./libraryWiring");
    const { recordOpened, shelfEntries } = await import("./libraryStore");
    const { markBookFinished } = await import("./finished");
    markBookFinished(dom);
    const stop = connectShelf(session, false);
    recordOpened(dom);
    expect(shelfEntries()).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    stop();
  });

  it("com a capability migra e liga o sync", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const { connectShelf } = await import("./libraryWiring");
    const { shelfEntry } = await import("./libraryStore");
    const { markBookFinished } = await import("./finished");
    markBookFinished(dom);
    const stop = connectShelf(session, true);
    expect(shelfEntry("gb:55752")?.status).toBe("finished");
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    stop();
  });

  it("desligar depois de ligar volta a ignorar ações", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200 })));
    const { connectShelf } = await import("./libraryWiring");
    const { recordOpened, shelfEntries } = await import("./libraryStore");
    connectShelf(session, true)();
    connectShelf(null, false);
    recordOpened(dom);
    expect(shelfEntries()).toEqual([]);
  });
});

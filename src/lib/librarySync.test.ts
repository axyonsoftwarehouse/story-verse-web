import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Ebook } from "../data/types";
import type { ShelfEntry } from "./library";

const session = {
  access_token: "token-123",
  refresh_token: "",
  expires_at: 9999999999,
  user: { id: "user-1", email: "user@example.test" },
};

const dom = { id: "gb-55752", gutenbergId: 55752, title: "Dom Casmurro", author: "Machado de Assis", textLanguage: "pt" } as Ebook;

const empty: ShelfEntry = {
  bookKey: "gb:55752",
  source: "gutenberg",
  status: "reading",
  rating: null,
  review: null,
  startedOn: null,
  finishedOn: null,
  dnfReason: null,
  dnfNote: null,
  progressPercent: null,
  progressLabel: null,
  title: "Dom Casmurro",
  author: "Machado de Assis",
  coverUrl: null,
  series: null,
  seriesIndex: null,
  genre: null,
  language: "pt",
  updatedAt: "2026-10-22 19:00:00.000000+00",
  version: 1,
  deletedAt: null,
};
const serverEntry = (fields: Partial<ShelfEntry>): ShelfEntry => ({ ...empty, ...fields });

type Call = { method: string; path: string; query: URLSearchParams; body: Record<string, unknown> | null };

/** API falsa com as regras da real: base divergente → 409 com `current`; DELETE lógico; updatedSince. */
function fakeApi(initial: Record<string, ShelfEntry> = {}, reject?: { method: string; status: number; error: string }) {
  const db = new Map(Object.entries(initial));
  const calls: Call[] = [];
  let clock = 0;
  const stamp = () => `2026-10-22 21:${String(10 + Math.floor(clock / 60)).padStart(2, "0")}:${String(clock++ % 60).padStart(2, "0")}.000000+00`;
  const json = (status: number, body: unknown) => new Response(body === null ? null : JSON.stringify(body), { status });
  const conflict = (key: string) => json(409, { error: "A entrada mudou em outro aparelho.", code: "CONFLICT", current: db.get(key) ?? null });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const u = new URL(url);
      const method = init.method ?? "GET";
      const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
      calls.push({ method, path: u.pathname, query: u.searchParams, body });
      const key = decodeURIComponent(u.pathname.split("/").pop() ?? "");
      const current = db.get(key);
      if (reject && reject.method === method) return json(reject.status, { error: reject.error });
      if (method === "GET" && u.pathname !== "/api/v1/me/library") {
        return current && !current.deletedAt ? json(200, current) : json(404, { error: "Livro fora da estante." });
      }
      if (method === "GET") {
        const since = u.searchParams.get("updatedSince");
        const { serverTime } = await import("./libraryMerge");
        const items = [...db.values()]
          .filter((e) => !since || serverTime(e.updatedAt) > serverTime(since))
          .sort((a, b) => serverTime(b.updatedAt) - serverTime(a.updatedAt));
        return json(200, { items, nextCursor: null });
      }
      const { baseUpdatedAt, ...fields } = body ?? {};
      if (method === "PUT") {
        if (current && (current.deletedAt ? baseUpdatedAt !== null && baseUpdatedAt !== current.updatedAt : baseUpdatedAt !== current.updatedAt)) return conflict(key);
        const next = { ...(current ?? { ...empty, bookKey: key, version: 0 }), ...fields, bookKey: key, updatedAt: stamp(), deletedAt: null, version: (current?.version ?? 0) + 1 } as ShelfEntry;
        db.set(key, next);
        return json(200, next);
      }
      if (method === "PATCH") {
        if (!current || current.deletedAt) return json(404, { error: "Livro fora da estante." });
        if (baseUpdatedAt !== current.updatedAt) return conflict(key);
        const next = { ...current, ...fields, updatedAt: stamp(), version: current.version + 1 } as ShelfEntry;
        db.set(key, next);
        return json(200, next);
      }
      if (method === "DELETE") {
        if (!current) return json(404, { error: "Livro fora da estante." });
        db.set(key, { ...current, deletedAt: stamp(), updatedAt: stamp(), version: current.version + 1 });
        return json(204, null);
      }
      return json(400, { error: "?" });
    }),
  );
  return { calls, db };
}

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("VITE_API_URL", "https://api.example.test");
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function load() {
  const owner = await import("./dataOwner");
  await owner.activateDataOwner("user-1");
  const store = await import("./libraryStore");
  const sync = await import("./librarySync");
  store.setShelfEnabled(true);
  return { ...store, ...sync, activateDataOwner: owner.activateDataOwner };
}

describe("sincronização da estante", () => {
  it("sem internet a pendência fica", async () => {
    const s = await load();
    s.recordOpened(dom);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    expect(await s.syncShelf(session)).toBe(false);
    expect(s.shelfEntry("gb:55752")).toMatchObject({ local: true, status: "reading" });
  });

  it("cria com PUT e passa a seguir o servidor", async () => {
    const s = await load();
    s.recordOpened(dom);
    const api = fakeApi();
    expect(await s.syncShelf(session)).toBe(true);
    expect(api.calls[0]).toMatchObject({ method: "PUT", path: "/api/v1/me/library/gb%3A55752", body: { baseUpdatedAt: null, status: "reading" } });
    expect(api.calls[0].body).not.toHaveProperty("auto");
    expect(s.shelfEntry("gb:55752")).toMatchObject({ local: false, version: 1, pending: {} });
  });

  it("muda só os campos pendentes com PATCH", async () => {
    const api = fakeApi({ "gb:55752": serverEntry({}) });
    const s = await load();
    s.applyServerEntry(serverEntry({}), null, null);
    s.setRating("gb:55752", null);
    s.setReview("gb:55752", "Capitu traiu?");
    await s.syncShelf(session);
    const patch = api.calls.find((c) => c.method === "PATCH");
    expect(patch?.body).toEqual({ rating: null, review: "Capitu traiu?", baseUpdatedAt: "2026-10-22 19:00:00.000000+00" });
    expect(s.shelfEntry("gb:55752")).toMatchObject({ review: "Capitu traiu?", version: 2, pending: {} });
  });

  it("409 faz merge e tenta de novo uma vez", async () => {
    const api = fakeApi({ "gb:55752": serverEntry({ status: "finished", finishedOn: "2026-10-01", version: 2, updatedAt: "2026-10-22 19:30:00.000000+00" }) });
    const s = await load();
    s.applyServerEntry(serverEntry({ version: 1 }), null, null);
    s.setDates("gb:55752", null, "2026-10-01");
    s.setRating("gb:55752", 4.5);
    await s.syncShelf(session);
    expect(api.calls.filter((c) => c.method === "PATCH")).toHaveLength(2);
    expect(s.shelfEntry("gb:55752")).toMatchObject({ status: "finished", rating: 4.5, pending: {} });
  });

  it("remoção em outro aparelho some daqui", async () => {
    fakeApi({ "gb:55752": serverEntry({ deletedAt: "2026-10-22 22:00:00+00", updatedAt: "2026-10-22 22:00:00+00" }) });
    const s = await load();
    s.applyServerEntry(serverEntry({}), null, null);
    await s.syncShelf(session);
    expect(s.shelfEntry("gb:55752")).toBeNull();
  });

  it("remover aqui manda DELETE e esquece a entrada", async () => {
    const api = fakeApi({ "gb:55752": serverEntry({}) });
    const s = await load();
    s.applyServerEntry(serverEntry({}), null, null);
    s.removeFromShelf("gb:55752");
    await s.syncShelf(session);
    expect(api.calls[0].method).toBe("DELETE");
    expect(api.db.get("gb:55752")?.deletedAt).not.toBeNull();
    expect(s.shelfEntry("gb:55752")).toBeNull();
  });

  it("remoção dispara o sync na hora, sem esperar o intervalo", async () => {
    const api = fakeApi({ "gb:55752": serverEntry({}) });
    const s = await load();
    s.applyServerEntry(serverEntry({}), null, null);
    const stop = s.startShelfSync(session);
    try {
      await vi.waitFor(() => expect(api.calls.some((c) => c.method === "GET")).toBe(true));
      api.calls.length = 0;
      s.removeFromShelf("gb:55752");
      await vi.waitFor(() => expect(api.calls.some((c) => c.method === "DELETE")).toBe(true));
      expect(s.shelfEntry("gb:55752")).toBeNull();
    } finally {
      stop();
    }
  });

  it("PATCH em entrada que o servidor não tem esquece a entrada e não trava o sync", async () => {
    fakeApi({});
    const s = await load();
    s.applyServerEntry(serverEntry({}), null, null);
    s.recordOpened({ ...dom, id: "gb-1", gutenbergId: 1 } as Ebook);
    s.setRating("gb:55752", null);
    expect(await s.syncShelf(session)).toBe(true);
    expect(s.shelfEntry("gb:55752")).toBeNull();
    expect(s.shelfEntry("gb:1")).toMatchObject({ local: false });
  });

  it("não sincroniza se a conta ativa no aparelho não é a da sessão", async () => {
    const s = await load();
    s.recordOpened(dom);
    await s.activateDataOwner("outra-conta");
    const api = fakeApi();
    expect(await s.syncShelf(session)).toBe(false);
    expect(api.calls).toEqual([]);
  });

  it("PATCH recusado volta a entrada ao que o servidor tem", async () => {
    fakeApi({ "gb:55752": serverEntry({}) }, { method: "PATCH", status: 422, error: "Data no futuro." });
    const s = await load();
    s.applyServerEntry(serverEntry({}), "user-1", null);
    s.setDates("gb:55752", "2099-01-01", null);
    expect(await s.syncShelf(session)).toBe(true);
    expect(s.shelfEntry("gb:55752")).toMatchObject({ startedOn: null, pending: {}, local: false, version: 1 });
  });

  it("PUT recusado não finge que a entrada existe no servidor", async () => {
    fakeApi({}, { method: "PUT", status: 422, error: "Estante cheia." });
    const s = await load();
    s.recordOpened(dom);
    expect(await s.syncShelf(session)).toBe(true);
    expect(s.shelfEntry("gb:55752")).toBeNull();
  });

  it("403 (estante retirada da conta) para a rodada e guarda as pendências", async () => {
    const api = fakeApi({}, { method: "PUT", status: 403, error: "Recurso indisponível para esta conta." });
    const s = await load();
    s.recordOpened(dom);
    expect(await s.syncShelf(session)).toBe(false);
    expect(s.shelfEntry("gb:55752")).toMatchObject({ local: true, status: "reading" });
    expect(api.calls.filter((c) => c.method === "GET")).toEqual([]);
  });

  it("marco do sync tem sobreposição de 5 s", async () => {
    fakeApi({ "gb:1": serverEntry({ bookKey: "gb:1", updatedAt: "2026-10-22 21:00:10.000000+00" }) });
    const s = await load();
    await s.syncShelf(session);
    expect(s.readShelfSyncMark()).toBe("2026-10-22T21:00:05.000Z");
    expect(s.shelfEntry("gb:1")).not.toBeNull();
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import type { Ebook } from "../data/types";
import { isSyncedKey, merge } from "./cloudSync";
import { activateDataOwner } from "./dataOwner";
import { todayInBrazil } from "./library";
import {
  abandonBook,
  addToShelf,
  recordFinished,
  recordOpened,
  recordProgress,
  removeFromShelf,
  setShelfEnabled,
  setStatus,
  shelfEntries,
  shelfEntry,
} from "./libraryStore";

const dom = {
  id: "gb-55752",
  gutenbergId: 55752,
  title: "Dom Casmurro",
  author: "Machado de Assis",
  genre: "Romance",
  textLanguage: "pt",
} as Ebook;

beforeEach(() => {
  localStorage.clear();
  setShelfEnabled(false);
});

describe("estante local", () => {
  it("desligada não grava nada", () => {
    recordOpened(dom);
    expect(shelfEntries()).toEqual([]);
  });

  it("abrir cria 'lendo' automático uma vez e não rebaixa terminado", () => {
    setShelfEnabled(true);
    recordOpened(dom);
    expect(shelfEntry("gb:55752")).toMatchObject({
      status: "reading",
      startedOn: todayInBrazil(),
      title: "Dom Casmurro",
      genre: "Romance",
      local: true,
      pending: { auto: true },
    });
    recordFinished(dom);
    recordOpened(dom);
    expect(shelfEntry("gb:55752")).toMatchObject({ status: "finished", finishedOn: todayInBrazil(), progressPercent: 100 });
  });

  it("'quero ler' vira 'lendo' ao abrir", () => {
    setShelfEnabled(true);
    addToShelf(dom, "want_to_read");
    expect(shelfEntry("gb:55752")?.status).toBe("want_to_read");
    recordOpened(dom);
    expect(shelfEntry("gb:55752")?.status).toBe("reading");
  });

  it("progresso não muda o status", () => {
    setShelfEnabled(true);
    recordOpened(dom);
    recordProgress(dom, 42.6, "Capítulo 62");
    expect(shelfEntry("gb:55752")).toMatchObject({ status: "reading", progressPercent: 43, progressLabel: "Capítulo 62" });
  });

  it("abandonar exige motivo e retomar é explícito", () => {
    setShelfEnabled(true);
    recordOpened(dom);
    abandonBook("gb:55752", "slow", null);
    expect(shelfEntry("gb:55752")).toMatchObject({ status: "abandoned", dnfReason: "slow" });
    setStatus("gb:55752", "reading");
    expect(shelfEntry("gb:55752")).toMatchObject({ status: "reading", dnfReason: null, pending: { auto: false } });
  });

  it("remover entrada que nunca subiu apaga na hora", () => {
    setShelfEnabled(true);
    recordOpened(dom);
    removeFromShelf("gb:55752");
    expect(shelfEntry("gb:55752")).toBeNull();
    expect(shelfEntries()).toEqual([]);
  });

  it("cada conta tem a sua estante", async () => {
    setShelfEnabled(true);
    await activateDataOwner("conta-a");
    recordOpened(dom);
    await activateDataOwner("conta-b");
    expect(shelfEntries()).toEqual([]);
    await activateDataOwner("conta-a");
    expect(shelfEntries()).toHaveLength(1);
  });

  it("a estante não entra no snapshot do reading_state", () => {
    expect(isSyncedKey("storyverse:shelf-entries")).toBe(false);
    expect(isSyncedKey("storyverse:reading-progress")).toBe(true);
    expect(Object.keys(merge({ "storyverse:shelf-entries": "{}" }, {}, {}))).toEqual([]);
  });
});

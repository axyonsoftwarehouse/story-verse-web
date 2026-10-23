import { beforeEach, describe, expect, it } from "vitest";
import type { Ebook } from "../data/types";
import { finishedBooks, markBookFinished } from "./finished";
import { todayInBrazil } from "./library";
import { migrateLocalShelf } from "./libraryMigration";
import { recordOpened, setRating, setShelfEnabled, shelfEntry } from "./libraryStore";
import { saveProgress } from "./progress";

const dom = { id: "gb-55752", gutenbergId: 55752, title: "Dom Casmurro", author: "Machado de Assis", textLanguage: "pt" } as Ebook;
const memorias = { id: "gb-54829", gutenbergId: 54829, title: "Memórias Póstumas de Brás Cubas", author: "Machado de Assis", textLanguage: "pt" } as Ebook;

beforeEach(() => {
  localStorage.clear();
  setShelfEnabled(true);
});

describe("migração da estante", () => {
  it("terminados e começados viram estante, uma vez só", () => {
    markBookFinished(dom);
    saveProgress({ book: memorias, chapterIndex: 3, chapterLabel: "Capítulo IV", chapterCount: 10, scrollRatio: 0.5 });
    expect(migrateLocalShelf()).toBe(2);
    expect(shelfEntry("gb:55752")).toMatchObject({ status: "finished", finishedOn: todayInBrazil(), progressPercent: 100 });
    expect(shelfEntry("gb:54829")).toMatchObject({ status: "reading", progressPercent: 35, progressLabel: "Capítulo IV", startedOn: null });
    expect(migrateLocalShelf()).toBe(0);
    expect(finishedBooks()).toHaveLength(1);
  });

  it("não sobrescreve o que já está na estante", () => {
    recordOpened(dom);
    setRating("gb:55752", null);
    markBookFinished(dom);
    expect(migrateLocalShelf()).toBe(0);
    expect(shelfEntry("gb:55752")?.status).toBe("reading");
  });

  it("livro terminado e com progresso conta uma vez, como terminado", () => {
    markBookFinished(dom);
    saveProgress({ book: dom, chapterIndex: 9, chapterLabel: "Fim", chapterCount: 10, scrollRatio: 1 });
    expect(migrateLocalShelf()).toBe(1);
    expect(shelfEntry("gb:55752")?.status).toBe("finished");
  });

  it("desligada não migra", () => {
    setShelfEnabled(false);
    markBookFinished(dom);
    expect(migrateLocalShelf()).toBe(0);
    setShelfEnabled(true);
    expect(migrateLocalShelf()).toBe(1);
  });
});

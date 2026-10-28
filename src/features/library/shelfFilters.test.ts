import { describe, expect, it } from "vitest";
import { filterShelf } from "./shelfFilters";
import { e } from "./testEntry";


describe("filtros da estante", () => {
  it("filtra por gênero sem contar 'Da comunidade' e por ano de conclusão", () => {
    const list = [
      e({ bookKey: "gb:1", genre: "Romance", finishedOn: "2026-03-10" }),
      e({ bookKey: "cm:x", genre: "Da comunidade", finishedOn: "2025-01-01" }),
    ];
    expect(filterShelf(list, { genre: "Da comunidade" }, "recent", () => true)).toEqual([]);
    expect(filterShelf(list, { year: 2026 }, "recent", () => true).map((x) => x.bookKey)).toEqual(["gb:1"]);
  });

  it("importado sem arquivo continua na estante e sai do filtro 'possui arquivo'", () => {
    const list = [e({ bookKey: "local:-1", source: "local" })];
    expect(filterShelf(list, {}, "recent", () => false)).toHaveLength(1);
    expect(filterShelf(list, { hasFile: true }, "recent", () => false)).toEqual([]);
  });

  it("status, autor sem diferença de maiúsculas e nota mínima", () => {
    const list = [
      e({ bookKey: "gb:1", status: "finished", author: "Machado de Assis", rating: 4.5 }),
      e({ bookKey: "gb:2", status: "finished", author: "José de Alencar", rating: 3 }),
      e({ bookKey: "gb:3", status: "reading", author: "machado de assis" }),
    ];
    expect(filterShelf(list, { status: "finished" }, "recent", () => true).map((x) => x.bookKey)).toEqual(["gb:1", "gb:2"]);
    expect(filterShelf(list, { author: "MACHADO DE ASSIS" }, "recent", () => true)).toHaveLength(2);
    expect(filterShelf(list, { minRating: 4 }, "recent", () => true).map((x) => x.bookKey)).toEqual(["gb:1"]);
  });

  it("ordena por título, nota e conclusão com vazios no fim", () => {
    const list = [
      e({ bookKey: "gb:1", title: "Senhora", rating: 3, finishedOn: "2026-01-01", touchedAt: 1 }),
      e({ bookKey: "gb:2", title: "Dom Casmurro", rating: null, finishedOn: null, touchedAt: 3 }),
      e({ bookKey: "gb:3", title: "Iracema", rating: 5, finishedOn: "2026-05-01", touchedAt: 2 }),
    ];
    const keys = (sort: Parameters<typeof filterShelf>[2]) => filterShelf(list, {}, sort, () => true).map((x) => x.bookKey);
    expect(keys("title")).toEqual(["gb:2", "gb:3", "gb:1"]);
    expect(keys("rating")).toEqual(["gb:3", "gb:1", "gb:2"]);
    expect(keys("finished")).toEqual(["gb:3", "gb:1", "gb:2"]);
    expect(keys("recent")).toEqual(["gb:2", "gb:3", "gb:1"]);
  });
});

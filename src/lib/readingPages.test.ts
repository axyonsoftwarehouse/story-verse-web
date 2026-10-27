import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readingReport } from "./ranking";
import { addSeenBlocks, countWords, recentReadingPages, WORDS_PER_PAGE } from "./readingPages";

/** Terça, 27/10/2026, meio-dia. */
const NOW = new Date(2026, 9, 27, 12);

describe("páginas lidas (1 página = 250 palavras)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("conta palavras com letras ou números, não pontuação solta", () => {
    expect(countWords("  Era uma vez — um livro, em 1850.  ")).toBe(7);
    expect(countWords("")).toBe(0);
  });

  it("cada parágrafo conta uma vez por dia e a página fecha a cada 250 palavras", () => {
    expect(
      addSeenBlocks([
        { key: "1:0:0", words: 200 },
        { key: "1:0:1", words: 100 },
      ]),
    ).toBe(300);
    expect(addSeenBlocks([{ key: "1:0:1", words: 100 }])).toBe(0);
    expect(recentReadingPages(8)).toEqual({ "2026-10-27": 1 });
    addSeenBlocks([{ key: "1:0:2", words: 2 * WORDS_PER_PAGE - 300 }]);
    expect(recentReadingPages(8)).toEqual({ "2026-10-27": 2 });
  });

  it("no dia seguinte o mesmo parágrafo conta de novo", () => {
    addSeenBlocks([{ key: "1:0:0", words: 250 }]);
    vi.setSystemTime(new Date(2026, 9, 28, 9));
    expect(addSeenBlocks([{ key: "1:0:0", words: 250 }])).toBe(250);
    expect(recentReadingPages(8)).toEqual({ "2026-10-27": 1, "2026-10-28": 1 });
  });

  it("guarda só os últimos 8 dias", () => {
    for (let d = 0; d < 10; d++) {
      vi.setSystemTime(new Date(2026, 9, 18 + d, 12));
      addSeenBlocks([{ key: "1:0:0", words: 250 }]);
    }
    expect(Object.keys(recentReadingPages(30))).toHaveLength(8);
  });

  it("o relatório junta segundos e páginas por dia", () => {
    localStorage.setItem(
      "storyverse:reading-stats",
      JSON.stringify({ "2026-10-26": 600, "2026-10-27": 300 }),
    );
    addSeenBlocks([{ key: "1:0:0", words: 520 }]);
    expect(readingReport()).toEqual({
      "2026-10-26": { seconds: 600, pages: 0 },
      "2026-10-27": { seconds: 300, pages: 2 },
    });
  });
});

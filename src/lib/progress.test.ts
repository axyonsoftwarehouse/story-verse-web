import { describe, expect, it } from "vitest";
import { progressPct, type ReadingProgress } from "./progress";

function progress(chapterIndex: number, scrollRatio: number, chapterCount = 4): ReadingProgress {
  return {
    book: { id: "gb-1", gutenbergId: 1, title: "Livro", author: "Autor", textLanguage: "pt" },
    chapterIndex,
    chapterLabel: `Capítulo ${chapterIndex + 1}`,
    chapterCount,
    scrollRatio,
    updatedAt: 0,
  };
}

describe("progressPct", () => {
  it("conta a fração do capítulo atual, sem atrasar um capítulo", () => {
    // Fim do capítulo 1 e início do capítulo 2 caem no mesmo ponto da linha do tempo.
    expect(progressPct(progress(0, 0))).toBe(0);
    expect(progressPct(progress(1, 0))).toBeCloseTo(25);
    expect(progressPct(progress(0, 1))).toBeCloseTo(25);
    expect(progressPct(progress(1, 0.5))).toBeCloseTo(37.5);
    expect(progressPct(progress(3, 1))).toBe(100);
  });

  it("não passa de 100% e trata livro sem capítulos", () => {
    expect(progressPct(progress(3, 2))).toBe(100);
    expect(progressPct(progress(0, 0.5, 0))).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { chapterSubtitle } from "./importBook";

describe("chapterSubtitle", () => {
  it("keeps titles that start with chapter-like letters", () => {
    expect(chapterSubtitle("Coelho maldito")).toBe("Coelho maldito");
    expect(chapterSubtitle("Iracema")).toBe("Iracema");
    expect(chapterSubtitle("Vidas Secas")).toBe("Vidas Secas");
    expect(chapterSubtitle("Xerife")).toBe("Xerife");
    expect(chapterSubtitle("Cidade de Deus")).toBe("Cidade de Deus");
  });

  it("removes numbering that is followed by punctuation", () => {
    expect(chapterSubtitle("IV. A chegada")).toBe("A chegada");
    expect(chapterSubtitle("1. PRIMEIRA VISTA")).toBe("PRIMEIRA VISTA");
    expect(chapterSubtitle("2) O caminho")).toBe("O caminho");
  });

  it("removes an arabic number even without punctuation", () => {
    expect(chapterSubtitle("1 PRIMEIRA VISTA")).toBe("PRIMEIRA VISTA");
  });

  it("removes the chapter word and its number", () => {
    expect(chapterSubtitle("Capítulo 1: Coelho maldito")).toBe("Coelho maldito");
    expect(chapterSubtitle("Chapter 2 - The Road")).toBe("The Road");
  });

  it("truncates very long subtitles", () => {
    const title = "A".repeat(80);
    expect(chapterSubtitle(title)).toBe(`${"A".repeat(67)}…`);
  });
});

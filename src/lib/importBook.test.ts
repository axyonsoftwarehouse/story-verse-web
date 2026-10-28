import { describe, expect, it } from "vitest";
import { chapterSubtitle, pdfLinesToText } from "./importBook";

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

describe("pdfLinesToText", () => {
  const body = (text: string, y: number) => ({ text, x: 50, y, h: 10, w: 400 });
  const big = (text: string, y: number) => ({ text, x: 120, y, h: 20, w: 200 });
  // Corpo suficiente para a mediana das linhas ser a fonte do texto, não a do título.
  const filler = (y: number) =>
    Array.from({ length: 8 }, (_, i) =>
      body(`Linha ${i + 1} do corpo do texto, comprida como as outras linhas da página.`, y - i * 12),
    );

  it("joins a chapter title broken across several large lines", () => {
    const text = pdfLinesToText([
      [
        big("CAPÍTULO 1: ZEN", 700),
        big("NAS", 675),
        big("ARTES MARCIAIS", 650),
        body("Vários livros discutem as artes marciais orientais, mas poucos se concentram no Zen.", 600),
        body("O autor começou pelo karatê e só depois chegou ao Zen, por outro caminho.", 588),
        body("Com o tempo, ele percebeu que as artes marciais eram um caminho de vida.", 576),
        ...filler(560),
      ],
    ]);
    expect(text.split("\n\n")[0]).toBe("Capítulo 1: ZEN NAS ARTES MARCIAIS");
    expect(text).not.toMatch(/\n\nNAS\n\n|\n\nARTES/);
  });

  it("keeps separate large titles that are far apart", () => {
    const text = pdfLinesToText([
      [
        big("Prefácio", 700),
        body("Um texto curto de abertura que fica entre os dois títulos da página.", 650),
        big("Agradecimentos", 500),
        body("Obrigado a todos que ajudaram neste livro, do começo ao fim.", 450),
        ...filler(430),
      ],
    ]);
    expect(text).toContain("Prefácio");
    expect(text).toContain("\n\nAgradecimentos\n\n");
  });
});

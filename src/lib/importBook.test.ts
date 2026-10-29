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

describe("importBookFile (EPUB)", () => {
  it("traz resumo, assuntos, série e ISBN do OPF", async () => {
    const { zipSync, strToU8 } = await import("fflate");
    const { importBookFile } = await import("./importBook");
    const chapter = `<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Capítulo 1</h1>${"<p>Era uma vez um menino que morava perto do rio e gostava de ler histórias antigas.</p>".repeat(20)}</body></html>`;
    const zip = zipSync({
      mimetype: strToU8("application/epub+zip"),
      "META-INF/container.xml": strToU8(
        `<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>`,
      ),
      "OEBPS/content.opf": strToU8(`<?xml version="1.0"?>
        <package xmlns="http://www.idpf.org/2007/opf" xmlns:opf="http://www.idpf.org/2007/opf">
          <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
            <dc:title>O Menino do Rio</dc:title>
            <dc:creator>Fulano de Tal</dc:creator>
            <dc:description>&lt;p&gt;Um menino, um rio e muitas histórias.&lt;/p&gt;</dc:description>
            <dc:subject>Aventura</dc:subject>
            <dc:identifier opf:scheme="ISBN">9788500000001</dc:identifier>
            <meta name="calibre:series" content="Histórias do Rio"/>
            <meta name="calibre:series_index" content="3"/>
          </metadata>
          <manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest>
          <spine><itemref idref="c1"/></spine>
        </package>`),
      "OEBPS/c1.xhtml": strToU8(chapter),
    });
    const book = await importBookFile(new File([zip], "livro.epub"));
    expect(book.title).toBe("O Menino do Rio");
    expect(book.details).toEqual({
      description: "Um menino, um rio e muitas histórias.",
      subjects: ["Aventura"],
      series: "Histórias do Rio",
      seriesIndex: 3,
      isbn: "9788500000001",
    });
  });
});

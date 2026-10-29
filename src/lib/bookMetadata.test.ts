import { afterEach, describe, expect, it, vi } from "vitest";
import { epubDetails, genreFromSubjects, htmlToText, lookupBookDetails, pdfDetails } from "./bookMetadata";

function opf(metadata: string): Document {
  return new DOMParser().parseFromString(
    `<?xml version="1.0"?>
    <package xmlns="http://www.idpf.org/2007/opf" xmlns:opf="http://www.idpf.org/2007/opf" version="3.0">
      <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">${metadata}</metadata>
    </package>`,
    "application/xml",
  );
}

describe("epubDetails", () => {
  it("lê resumo em HTML, assuntos, série do Calibre e ISBN", () => {
    const details = epubDetails(
      opf(`
        <dc:description>&lt;p&gt;Um garoto descobre que é bruxo.&lt;/p&gt;&lt;p&gt;E vai para Hogwarts.&lt;/p&gt;</dc:description>
        <dc:subject>Fantasy fiction</dc:subject>
        <dc:subject>Wizards</dc:subject>
        <dc:identifier opf:scheme="ISBN">978-85-325-1101-4</dc:identifier>
        <meta name="calibre:series" content="Harry Potter"/>
        <meta name="calibre:series_index" content="1.0"/>
      `),
    );
    expect(details).toEqual({
      description: "Um garoto descobre que é bruxo.\n\nE vai para Hogwarts.",
      subjects: ["Fantasy fiction", "Wizards"],
      series: "Harry Potter",
      seriesIndex: 1,
      isbn: "9788532511014",
    });
  });

  it("lê a série do EPUB 3 (belongs-to-collection)", () => {
    const details = epubDetails(
      opf(`
        <dc:identifier>urn:isbn:0441013597</dc:identifier>
        <meta property="belongs-to-collection" id="c1">Duna</meta>
        <meta refines="#c1" property="collection-type">series</meta>
        <meta refines="#c1" property="group-position">2</meta>
      `),
    );
    expect(details.series).toBe("Duna");
    expect(details.seriesIndex).toBe(2);
    expect(details.isbn).toBe("0441013597");
  });

  it("ignora coleção editorial (collection-type set)", () => {
    const details = epubDetails(
      opf(`
        <meta property="belongs-to-collection" id="c1">Clássicos Penguin</meta>
        <meta refines="#c1" property="collection-type">set</meta>
      `),
    );
    expect(details.series).toBeUndefined();
  });

  it("devolve vazio quando o OPF não tem nada além do básico", () => {
    expect(epubDetails(opf(`<dc:title>Iracema</dc:title>`))).toEqual({
      description: undefined,
      subjects: undefined,
      series: undefined,
      seriesIndex: undefined,
      isbn: undefined,
    });
  });
});

describe("pdfDetails", () => {
  it("assunto curto vira assunto; palavras-chave também", () => {
    expect(pdfDetails({ Subject: "Ficção", Keywords: "terror; vampiros" })).toEqual({
      description: undefined,
      subjects: ["Ficção", "terror", "vampiros"],
    });
  });

  it("assunto longo vira resumo", () => {
    const subject = "Um romance sobre a vida de um homem que volta para a cidade natal depois de muitos anos.";
    expect(pdfDetails({ Subject: subject }).description).toBe(subject);
  });
});

describe("genreFromSubjects", () => {
  it("converte assuntos em pt e en para a lista do acervo", () => {
    expect(genreFromSubjects(["Fantasy fiction", "Wizards"])).toBe("Fantasia");
    expect(genreFromSubjects(["Ficção científica brasileira"])).toBe("Ficção científica");
    expect(genreFromSubjects(["Detective and mystery stories"])).toBe("Mistério");
    expect(genreFromSubjects(["Contos brasileiros"])).toBe("Conto");
  });

  it("não inventa gênero sem correspondência clara", () => {
    expect(genreFromSubjects(["History", "Brazil"])).toBeUndefined();
    expect(genreFromSubjects(undefined)).toBeUndefined();
  });
});

describe("htmlToText", () => {
  it("mantém texto simples e junta espaços", () => {
    expect(htmlToText("  Um   livro  ")).toBe("Um livro");
  });
});

describe("lookupBookDetails", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(routes: Record<string, unknown>) {
    const fetchMock = vi.fn(async (url: string) => {
      const match = Object.keys(routes).find((key) => url.includes(key));
      return match
        ? new Response(JSON.stringify(routes[match]), { status: 200 })
        : new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  const ptExtract =
    "Dom Casmurro é um romance escrito por Machado de Assis, publicado em 1899. A obra conta a história de Bentinho e de sua desconfiança.";

  it("livro em português: resumo da Wikipedia, gênero pelos assuntos da Open Library", async () => {
    stubFetch({
      "/openlibrary/search.json": {
        docs: [
          { key: "/works/OL1W", author_name: ["Machado de Assis"], subject: ["Love stories", "series:Obras_de_Machado"] },
        ],
      },
      "/openlibrary/works/OL1W.json": { description: "An English description that is long enough to count as a summary here." },
      "/w/rest.php/v1/search/page": { pages: [{ key: "Dom_Casmurro", description: "romance de Machado de Assis" }] },
      "/api/rest_v1/page/summary/Dom_Casmurro": { type: "standard", extract: ptExtract },
    });
    const found = await lookupBookDetails({ title: "Dom Casmurro", author: "Machado de Assis", language: "pt" });
    expect(found).toEqual({
      description: ptExtract,
      descriptionSource: "Wikipedia",
      subjects: ["Love stories"],
      series: "Obras de Machado",
    });
  });

  it("não usa resumo em outro idioma nem página de outro autor", async () => {
    stubFetch({
      "/openlibrary/search.json": { docs: [{ key: "/works/OL1W", author_name: ["Outra Pessoa"] }] },
      "/w/rest.php/v1/search/page": { pages: [{ key: "Outro", description: "romance" }] },
      "/api/rest_v1/page/summary/Outro": { type: "standard", extract: ptExtract.replace("Machado de Assis", "Fulano") },
    });
    const found = await lookupBookDetails({ title: "Dom Casmurro", author: "Machado de Assis", language: "pt" });
    expect(found.description).toBeUndefined();
    expect(found.subjects).toBeUndefined();
  });

  it("busca pelo ISBN quando o arquivo traz", async () => {
    const fetchMock = stubFetch({});
    await lookupBookDetails({ title: "Duna", author: "Frank Herbert", language: "pt", isbn: "0441013597" });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("isbn=0441013597"))).toBe(true);
  });
});

// Só o tipo: o leitor do app (importBook) usa este arquivo e não deve carregar o admin.
import type { CATALOG_GENRES } from "./adminCatalog";

/**
 * Metadados além de título e autor: o que o próprio arquivo traz (OPF do EPUB, propriedades do
 * PDF) e, para o que faltar, o que a Open Library e a Wikipedia sabem do livro. Sem IA: campo
 * que nenhuma fonte preencher fica vazio para o admin completar.
 */

export type BookDetails = {
  description?: string;
  /** Assuntos como vieram da fonte ("Fantasy fiction", "Romance brasileiro"). */
  subjects?: string[];
  series?: string;
  seriesIndex?: number;
  isbn?: string;
};

export type DetailSource = "arquivo" | "Open Library" | "Wikipedia";

/** Resumo gravado como HTML (comum no Calibre) vira texto com parágrafos. */
export function htmlToText(source: string): string {
  if (!/<[a-z][\s\S]*>/i.test(source)) return source.replace(/\s+/g, " ").trim();
  const doc = new DOMParser().parseFromString(source, "text/html");
  for (const br of Array.from(doc.querySelectorAll("br"))) br.replaceWith("\n");
  const blocks = Array.from(doc.body.querySelectorAll("p,div,li")).filter((el) => !el.querySelector("p,div,li"));
  const parts = (blocks.length ? blocks : [doc.body]).map((el) =>
    (el.textContent ?? "").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim(),
  );
  return parts.filter(Boolean).join("\n\n");
}

function cleanIsbn(raw: string): string | undefined {
  const digits = raw.replace(/^urn:isbn:/i, "").replace(/[^\dXx]/g, "").toUpperCase();
  return digits.length === 10 || digits.length === 13 ? digits : undefined;
}

function seriesNumber(raw: string | null | undefined): number | undefined {
  const n = Number((raw ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Resumo, assuntos, série e ISBN do OPF. Série: o Calibre grava em
 * `<meta name="calibre:series">`; o EPUB 3 em `belongs-to-collection` + `group-position`.
 */
export function epubDetails(opf: Document): BookDetails {
  const all = (tag: string) => Array.from(opf.getElementsByTagNameNS("*", tag));
  const metas = all("meta");
  const named = (name: string) => metas.find((m) => m.getAttribute("name") === name)?.getAttribute("content")?.trim();

  const description = htmlToText(all("description")[0]?.textContent ?? "");
  const subjects = [...new Set(all("subject").map((s) => (s.textContent ?? "").trim()).filter(Boolean))];

  let series = named("calibre:series");
  let seriesIndex = seriesNumber(named("calibre:series_index"));
  if (!series) {
    const collection = metas.find(
      (m) =>
        m.getAttribute("property") === "belongs-to-collection" &&
        // Sem collection-type, ou "series": "set" é coleção editorial, não série.
        !metas.some(
          (r) =>
            r.getAttribute("refines") === `#${m.getAttribute("id")}` &&
            r.getAttribute("property") === "collection-type" &&
            r.textContent?.trim() !== "series",
        ),
    );
    if (collection) {
      series = collection.textContent?.trim() || undefined;
      const position = metas.find(
        (r) =>
          r.getAttribute("refines") === `#${collection.getAttribute("id")}` &&
          r.getAttribute("property") === "group-position",
      );
      seriesIndex = seriesNumber(position?.textContent);
    }
  }

  let isbn: string | undefined;
  for (const id of all("identifier")) {
    const scheme = `${id.getAttribute("opf:scheme") ?? ""} ${id.getAttributeNS("*", "scheme") ?? ""} ${id.getAttribute("scheme") ?? ""}`;
    const text = id.textContent?.trim() ?? "";
    if (/isbn/i.test(scheme) || /^urn:isbn:/i.test(text)) isbn = cleanIsbn(text);
    if (isbn) break;
  }

  return {
    description: description || undefined,
    subjects: subjects.length ? subjects : undefined,
    series: series || undefined,
    seriesIndex: series ? seriesIndex : undefined,
    isbn,
  };
}

/** Propriedades do PDF: "Assunto" costuma ser uma frase sobre o livro; palavras-chave, assuntos. */
export function pdfDetails(info: { Subject?: string; Keywords?: string }): BookDetails {
  const subject = info.Subject?.trim() ?? "";
  const keywords = (info.Keywords ?? "")
    .split(/[;,]/)
    .map((k) => k.trim())
    .filter(Boolean);
  return {
    // Assunto curto ("Ficção") é um assunto, não um resumo.
    description: subject.length >= 80 ? subject : undefined,
    subjects: [...(subject && subject.length < 80 ? [subject] : []), ...keywords].filter(Boolean),
  };
}

/** Palavras dos assuntos (pt e en) que indicam cada gênero da lista do acervo; ordem = prioridade. */
const GENRE_HINTS: [(typeof CATALOG_GENRES)[number], RegExp][] = [
  ["Infantil", /\b(infantil|infanto|children|juvenile)/],
  ["Ficção científica", /(ficcao cientifica|science fiction|sci-fi|scifi|distopi|dystopi)/],
  ["Fantasia", /\b(fantasia|fantasy|magia|magic|wizard|bruxo|dragon|dragao)/],
  ["Terror", /\b(terror|horror|sobrenatural|supernatural|vampir|ghost|fantasma)/],
  ["Mistério", /\b(misterio|mystery|policial|detective|detetive|suspense|thriller|crime)/],
  ["Biografia", /\b(biografi|biography|autobiograf|memorias|memoirs?)\b/],
  ["Poesia", /\b(poesia|poetry|poemas?|poems?|sonetos?|sonnets?)\b/],
  ["Conto", /\b(contos?|short stories|short story)\b/],
  ["Ensaio", /\b(ensaios?|essays?|filosofia|philosophy|cronicas?)\b/],
  ["Aventura", /\b(aventura|adventure)/],
  ["Romance", /\b(romance|love stories|romantic)\b/],
];

const normalize = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Primeiro gênero da lista do acervo que algum assunto indica; sem correspondência clara, nada. */
export function genreFromSubjects(subjects: string[] | undefined): string | undefined {
  if (!subjects?.length) return undefined;
  const hay = subjects.map(normalize);
  return GENRE_HINTS.find(([, pattern]) => hay.some((s) => pattern.test(s)))?.[0];
}

/* ------------------------- Fontes externas -------------------------- */

/** Open Library pelo próprio domínio (vercel.json / vite.config.ts / Caddyfile). */
const OL_BASE = "/openlibrary";
const TIMEOUT_MS = 8_000;
/** Resumo mais curto que isso é só uma linha de catálogo. */
const MIN_DESCRIPTION_CHARS = 80;

async function getJson<T>(url: string): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const PT_WORDS = ["de", "que", "não", "uma", "para", "com", "um", "os", "das", "dos", "seu", "sua"];
const EN_WORDS = ["the", "and", "of", "to", "was", "his", "her", "with", "is", "in", "a", "their"];

function writtenIn(text: string, language: "pt" | "en"): boolean {
  const words = ` ${normalize(text).replace(/[^a-z\s]/g, " ")} `;
  const count = (list: string[]) => list.reduce((n, w) => n + (words.split(` ${normalize(w)} `).length - 1), 0);
  const pt = count(PT_WORDS);
  const en = count(EN_WORDS);
  return language === "pt" ? pt > en : en > pt;
}

/** Sobrenome do autor, sem acento, para conferir se a fonte fala do mesmo livro. */
function authorKey(author: string): string {
  const parts = normalize(author).split(/[^a-z]+/).filter((p) => p.length >= 3);
  return parts[parts.length - 1] ?? "";
}

type OlSearchDoc = { key?: string; title?: string; author_name?: string[]; subject?: string[] };
type OlWork = { description?: string | { value?: string }; subjects?: string[] };

async function fromOpenLibrary(
  book: { title: string; author: string; isbn?: string },
  language: "pt" | "en",
): Promise<BookDetails> {
  const fields = "key,title,author_name,subject";
  const params: Record<string, string> = book.isbn
    ? { isbn: book.isbn, fields, limit: "1" }
    : { title: book.title, author: book.author, fields, limit: "3" };
  const found = await getJson<{ docs?: OlSearchDoc[] }>(`${OL_BASE}/search.json?${new URLSearchParams(params)}`);
  const surname = authorKey(book.author);
  const doc = found?.docs?.find(
    (d) => !surname || (d.author_name ?? []).some((a) => normalize(a).includes(surname)),
  );
  if (!doc?.key) return {};

  const work = await getJson<OlWork>(`${OL_BASE}${doc.key}.json`);
  const raw = typeof work?.description === "string" ? work.description : (work?.description?.value ?? "");
  // A Open Library mistura links e notas de fonte ("----------\nContains: ...") no resumo.
  const description = raw.split(/\n-{3,}|\(\[source\]/i)[0].replace(/\r/g, "").trim();
  const subjects = [...(doc.subject ?? []), ...(work?.subjects ?? [])];
  // Série vem como assunto marcado: "series:Harry_Potter" (sem o número do volume).
  const series = subjects.find((s) => /^series:/i.test(s))?.replace(/^series:/i, "").replace(/_/g, " ").trim();
  return {
    description:
      description.length >= MIN_DESCRIPTION_CHARS && writtenIn(description, language) ? description : undefined,
    subjects: subjects.filter((s) => !/^\w+:/.test(s)).slice(0, 40),
    series: series || undefined,
  };
}

type WikiSearch = { pages?: { key: string; description?: string | null }[] };
type WikiSummary = { type?: string; extract?: string };

/** Página da Wikipedia sobre o livro: precisa ser descrita como livro/romance e citar o autor. */
async function fromWikipedia(book: { title: string; author: string }, language: "pt" | "en"): Promise<BookDetails> {
  const host = `https://${language}.wikipedia.org`;
  const query = `${book.title} ${book.author}`.trim();
  const found = await getJson<WikiSearch>(`${host}/w/rest.php/v1/search/page?${new URLSearchParams({ q: query, limit: "3" })}`);
  const surname = authorKey(book.author);
  const isBook = /livro|romance|novela|conto|obra|poema|book|novel|novella|story|poem/i;
  for (const page of found?.pages ?? []) {
    if (page.description && !isBook.test(page.description)) continue;
    const summary = await getJson<WikiSummary>(`${host}/api/rest_v1/page/summary/${encodeURIComponent(page.key)}`);
    const extract = summary?.extract?.trim() ?? "";
    if (summary?.type === "disambiguation" || extract.length < MIN_DESCRIPTION_CHARS) continue;
    if (!isBook.test(extract)) continue;
    if (surname && !normalize(extract).includes(surname)) continue;
    return { description: extract };
  }
  return {};
}

/**
 * Busca resumo e assuntos fora do arquivo. Resumo só no idioma do livro: na Open Library quase
 * sempre está em inglês, então para livro em português a Wikipedia vem primeiro.
 */
export async function lookupBookDetails(book: {
  title: string;
  author: string;
  language: "pt" | "en";
  isbn?: string;
}): Promise<{ description?: string; descriptionSource?: DetailSource; subjects?: string[]; series?: string }> {
  if (!book.title.trim()) return {};
  const [ol, wiki] = await Promise.all([
    fromOpenLibrary(book, book.language),
    fromWikipedia(book, book.language),
  ]);
  const ordered: [DetailSource, BookDetails][] =
    book.language === "pt"
      ? [["Wikipedia", wiki], ["Open Library", ol]]
      : [["Open Library", ol], ["Wikipedia", wiki]];
  const withDescription = ordered.find(([, d]) => d.description);
  return {
    description: withDescription?.[1].description,
    descriptionSource: withDescription?.[0],
    subjects: ol.subjects?.length ? ol.subjects : undefined,
    series: ol.series,
  };
}

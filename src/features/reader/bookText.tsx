import { IMAGE_MARKER } from "../../lib/imageMarkers";

export type Block = { kind: "heading" | "p" | "image"; text: string };

/** Termina como frase (ponto, interrogação, aspas de fecho…): o parágrafo não continua no próximo. */
const ENDS_SENTENCE = /[.!?…:;"»”)\]]$/;

/** Títulos de seção de verdade: "Capítulo 3", "PARTE II", "Prólogo", numeral romano sozinho. */
const SECTION_WORD =
  /^(cap[ií]tulo|chapter|parte|part|livro|book|pr[oó]logo|prologue|ep[ií]logo|epilogue|pref[aá]cio|preface|introdu[cç][aã]o|introduction|ato|act|cena|scene)\b/i;

const ROMAN_ALONE = /^[IVXLC]{1,9}\.?$/;

function isHeading(p: string, next: string | undefined): boolean {
  if (p.startsWith("—") || p.startsWith("-") || p.length > 90) return false;
  if (SECTION_WORD.test(p) || ROMAN_ALONE.test(p)) return true;
  // Todo em maiúsculas ("O RETRATO", "A SCANDAL IN BOHEMIA").
  const letters = p.replace(/[^\p{L}]/gu, "");
  if (letters.length >= 3 && p === p.toUpperCase() && !/[!?]$/.test(p)) return true;
  // Linha curta com cara de título: começa em maiúscula, poucas palavras, sem pontuação final,
  // e o parágrafo seguinte começa de novo (não é continuação da mesma frase).
  const words = p.split(/\s+/).length;
  return (
    p.length <= 50 &&
    words <= 8 &&
    /^[\p{Lu}\d"“«]/u.test(p) &&
    !/[,.!?…:;"»”)\-—]$/.test(p) &&
    (next === undefined || /^[\p{Lu}\d"“«—-]/u.test(next))
  );
}

/**
 * Os .txt do Gutenberg quebram as linhas a cada ~70 caracteres e separam parágrafos por
 * linha em branco: cada bloco vira um parágrafo. PDFs e EPUBs às vezes quebram uma frase no meio
 * ("…encontrei no trem da" + "Central um rapaz…"): esses pedaços voltam a ser um parágrafo só.
 * Só vira subtítulo (em destaque) o que é mesmo título de seção.
 */
export type BookSearchHit = {
  chapterIndex: number;
  chapterLabel: string;
  paragraph: number;
  start: number;
  before: string;
  match: string;
  after: string;
};

/** Até 60 trechos onde o termo aparece (sem diferenciar maiúsculas nem acentos). */
export function searchBook(
  blocksByChapter: Block[][],
  chapters: { label: string }[],
  term: string,
): { hits: BookSearchHit[]; total: number } {
  const plainText = (t: string) =>
    t
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const needle = plainText(term.trim());
  if (needle.length < 2) return { hits: [], total: 0 };
  const hits: BookSearchHit[] = [];
  let total = 0;
  blocksByChapter.forEach((blocks, chapterIndex) => {
    blocks.forEach((b, paragraph) => {
      if (b.kind === "image") return;
      const text = b.text.replace(/_/g, "");
      // A normalização mantém o tamanho do texto (só tira os acentos combinados depois de NFD).
      const hay = plainText(text);
      let at = hay.indexOf(needle);
      while (at !== -1) {
        total++;
        if (hits.length < 60) {
          const from = Math.max(0, at - 50);
          const to = Math.min(text.length, at + needle.length + 70);
          hits.push({
            chapterIndex,
            chapterLabel: chapters[chapterIndex]?.label ?? "",
            paragraph,
            start: at,
            before: `${from > 0 ? "…" : ""}${text.slice(from, at)}`,
            match: text.slice(at, at + needle.length),
            after: `${text.slice(at + needle.length, to)}${to < text.length ? "…" : ""}`,
          });
        }
        at = hay.indexOf(needle, at + needle.length);
      }
    });
  });
  return { hits, total };
}

export function toBlocks(text: string, skipHeadline?: string): Block[] {
  // Ignora o "(1/2)" que o app acrescenta quando divide um capítulo longo em partes.
  const norm = (s: string) =>
    s
      .toUpperCase()
      .replace(/\s*\(\d+\/\d+\)$/, "")
      .replace(/\s+/g, " ")
      .replace(/[\].\s]+$/, "");
  const raw = text
    .replace(/\r\n/g, "\n")
    .split(/\n[ \t]*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  // O título do capítulo já aparece no topo: não repete ("Capítulo I" + "I" logo abaixo).
  if (skipHeadline && raw[0]) {
    const label = norm(skipHeadline);
    const first = norm(raw[0]);
    if (first === label || (ROMAN_ALONE.test(raw[0]) && label.endsWith(` ${first}`))) raw.shift();
  }

  // Junta pedaços de frase: sem pontuação no fim e o próximo começando em minúscula.
  const paras: string[] = [];
  for (const p of raw) {
    const prev = paras[paras.length - 1];
    if (
      prev &&
      !IMAGE_MARKER.test(prev) &&
      !IMAGE_MARKER.test(p) &&
      !ENDS_SENTENCE.test(prev) &&
      /^\p{Ll}/u.test(p)
    ) {
      paras[paras.length - 1] = `${prev.replace(/-$/, "")}${prev.endsWith("-") ? "" : " "}${p}`;
    } else {
      paras.push(p);
    }
  }

  return paras.map((p, i) => {
    const img = p.match(IMAGE_MARKER);
    if (img) return { kind: "image", text: img[1] };
    return { kind: isHeading(p, paras[i + 1]) ? "heading" : "p", text: p };
  });
}

/** O Gutenberg marca itálico como _assim_. */
export function withItalics(text: string): React.ReactNode {
  const parts = text.split(/_([^_]+)_/);
  return parts.length === 1 ? text : parts.map((p, i) => (i % 2 === 1 ? <em key={i}>{p}</em> : p));
}

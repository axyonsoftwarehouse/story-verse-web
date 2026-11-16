/**
 * Título e autor mínimos para um livro entrar no acervo público (U1 da revisão de 09/11).
 * A mesma regra está na API (SubmissionMetadata.java, story-verse-api): mudar as duas juntas.
 */

/** Extensões de arquivo de livro e de diagramação que já apareceram como título. */
const FILE_EXTENSION = /\.(indd|idml|pdf|epub|mobi|azw3?|docx?|odt|rtf|txt|fb2|html?|zip)$/i;

/** "Morte_DiaValePenaViver_FINAL.indd", "Livro[2025]": nome de arquivo, não título. */
export function looksLikeFileName(title: string): boolean {
  const t = title.trim();
  return FILE_EXTENSION.test(t) || t.includes("_") || t.includes("[") || t.includes("]");
}

function hasAuthor(author: string | null | undefined): boolean {
  const a = (author ?? "").trim();
  if (a.toLowerCase() === "autor não informado") return false;
  // Pelo menos duas letras: "V" ou "?" não identificam ninguém.
  return (a.match(/\p{L}/gu) ?? []).length >= 2;
}

/** Primeiro problema que impede publicar, ou `null` se título e autor servem. */
export function metadataProblem(title: string | null | undefined, author: string | null | undefined): string | null {
  const t = (title ?? "").trim();
  if (!t) return "Informe o título do livro.";
  if (looksLikeFileName(t)) return `O título parece nome de arquivo (“${t}”). Corrija o título antes de publicar.`;
  if (!hasAuthor(author)) return "Informe o autor do livro.";
  return null;
}

/**
 * Aviso que não impede publicar: título todo em maiúsculas costuma ser o nome do autor ou da capa
 * ("CLARISSA PINKOLA ESTES"). Uma palavra só passa ("IT").
 */
export function metadataWarning(title: string | null | undefined): string | null {
  const t = (title ?? "").trim();
  const words = t.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  if (words.length >= 2 && t === t.toLocaleUpperCase("pt-BR") && t !== t.toLocaleLowerCase("pt-BR")) {
    return "O título está todo em maiúsculas. Confira se é mesmo o título, e não o nome do autor.";
  }
  return null;
}

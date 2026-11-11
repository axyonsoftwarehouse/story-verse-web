/** Biografia do perfil: as mesmas regras da API (ProfileBio), para avisar antes de salvar. */

export const BIO_MAX = 160;
export const BIO_MAX_LINES = 4;

/** Espaços repetidos, linhas em branco a mais e caracteres invisíveis saem (o ZWJ dos emojis fica). */
export function normalizeBio(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/[\p{Cc}\p{Cf}]/gu, (c) => (c === "\n" || c === "‍" ? c : ""))
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Caracteres como o servidor conta (emoji vale um). */
export function bioLength(text: string): number {
  return Array.from(text).length;
}

/** Problema da biografia já limpa, ou `null` se pode salvar. */
export function bioProblem(text: string): string | null {
  if (bioLength(text) > BIO_MAX) return `A biografia pode ter até ${BIO_MAX} caracteres.`;
  if (text.split("\n").length > BIO_MAX_LINES) return `A biografia pode ter até ${BIO_MAX_LINES} linhas.`;
  return null;
}

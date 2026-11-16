/**
 * Quando o convite "Baixe o app" pode aparecer (U6 da revisão de 09/11): não na primeira visita,
 * antes de a pessoa conhecer o produto. Libera depois de abrir um livro ou na segunda visita
 * (outra aba ou outro dia). O botão "Baixar app" do topo continua sempre lá.
 */
const VISITS_KEY = "storyverse:visits";
const OPENED_KEY = "storyverse:opened-book";
/** Marca na sessão do navegador: a mesma visita não conta duas vezes (recarregar, StrictMode). */
const COUNTED_KEY = "storyverse:visit-counted";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sem armazenamento: o convite só aparece depois de abrir um livro nesta visita.
  }
}

/** Conta esta visita (uma vez por sessão do navegador). */
export function noteVisit(): void {
  try {
    if (sessionStorage.getItem(COUNTED_KEY)) return;
    sessionStorage.setItem(COUNTED_KEY, "1");
  } catch {
    return;
  }
  write(VISITS_KEY, String((Number(read(VISITS_KEY)) || 0) + 1));
}

/** A pessoa abriu um livro: já conhece o produto. */
export function noteBookOpened(): void {
  write(OPENED_KEY, "1");
}

export function installNudgeReady(): boolean {
  return read(OPENED_KEY) === "1" || (Number(read(VISITS_KEY)) || 0) >= 2;
}

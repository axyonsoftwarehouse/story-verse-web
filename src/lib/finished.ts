import type { Ebook } from "../data/types";

/** Livros que o leitor terminou (chegou ao fim do último capítulo), guardados no navegador. */
const KEY = "storyverse:finished-books";

type Finished = { book: Ebook; finishedAt: number };

function read(): Record<string, Finished> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, Finished>;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export function markBookFinished(book: Ebook) {
  const store = read();
  if (store[book.id]) return;
  store[book.id] = { book, finishedAt: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Sem espaço: só não aparece em "Terminados".
  }
}

/** Do terminado mais recente para o mais antigo. */
export function finishedBooks(): Finished[] {
  return Object.values(read())
    .filter((f) => f?.book?.id)
    .sort((a, b) => b.finishedAt - a.finishedAt);
}

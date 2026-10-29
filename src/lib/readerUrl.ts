import type { Ebook } from "../data/types";

/**
 * Endereço do leitor: com o livro aberto a barra mostra `/?ler=<id do livro>`. Se a página
 * recarregar (o iPhone faz isso ao voltar de outro app), o livro abre de novo em vez da home.
 *
 * Parâmetro e não caminho (`/ler/…`): a rota continua a mesma e o app não é remontado quando o
 * voltar do celular passa por esse endereço.
 */
const PARAM = "ler";
/** O livro aberto nesta aba, inteiro: abre de novo mesmo sem progresso salvo ainda. */
const OPEN_KEY = "storyverse:reading-now";

export function readerUrl(bookId: string): string {
  const params = new URLSearchParams(window.location.search);
  params.set(PARAM, bookId);
  return `${window.location.pathname}?${params.toString()}`;
}

/** Guarda o livro aberto nesta aba (sessionStorage: some quando a aba fecha). */
export function rememberOpenBook(book: Ebook | null): void {
  try {
    if (book) sessionStorage.setItem(OPEN_KEY, JSON.stringify(book));
    else sessionStorage.removeItem(OPEN_KEY);
  } catch {
    // Sem armazenamento: só não reabre a partir daqui (o progresso ainda serve).
  }
}

let taken: { id: string; book: Ebook | null } | null | undefined;

/**
 * Lê e tira `?ler=` da barra (o passo do livro entra de novo quando ele abrir). Devolve o id
 * pedido e, se for o mesmo livro aberto antes de recarregar, a cópia guardada dele.
 */
export function takeReaderParam(): { id: string; book: Ebook | null } | null {
  // Uma leitura por carregamento (o React em desenvolvimento chama o inicializador duas vezes).
  if (taken === undefined) taken = readParam();
  return taken;
}

function readParam(): { id: string; book: Ebook | null } | null {
  const params = new URLSearchParams(window.location.search);
  const id = params.get(PARAM);
  if (!id) return null;
  params.delete(PARAM);
  const rest = params.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
  let book: Ebook | null = null;
  try {
    const saved = JSON.parse(sessionStorage.getItem(OPEN_KEY) ?? "null") as Ebook | null;
    if (saved?.id === id) book = saved;
  } catch {
    // Cópia ilegível: procura o livro pelo progresso.
  }
  return { id, book };
}

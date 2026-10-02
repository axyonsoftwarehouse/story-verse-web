import type { Ebook } from "../data/types";
import { currentDataOwner, legacyDataOwner } from "./dataOwner";

/**
 * Livros que o leitor importou. Ficam só neste navegador (IndexedDB): o arquivo nunca sai do
 * aparelho. O localStorage não serve aqui porque um livro inteiro passa do limite dele.
 */
const DB_NAME = "storyverse-books";
const STORE = "books";

type StoredBook = {
  id: number;
  book: Ebook;
  text: string;
  importedAt: number;
  /** Ilustrações do livro (marcadas no texto como "[[img:<id>]]"). */
  images?: Record<string, Blob>;
  /** Conta que importou (sem ele: de antes da separação por conta, ver dataOwner.ts). */
  owner?: string;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error("Armazenamento do navegador indisponível."));
    };
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = op(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

/**
 * Livros importados usam `gutenbergId` negativo: assim progresso, traduções e elenco guardados
 * funcionam igual aos do acervo, sem colidir com os números do Gutenberg.
 */
export function newLocalBookId(): number {
  return -Date.now();
}

export function isLocalBook(book: Ebook): boolean {
  return book.source === "local";
}

export async function saveLocalBook(book: Ebook, text: string, images?: Record<string, Blob>): Promise<void> {
  try {
    await run("readwrite", (s) =>
      s.put({
        id: book.gutenbergId,
        book,
        text,
        importedAt: Date.now(),
        images,
        ...(currentDataOwner() ? { owner: currentDataOwner() ?? undefined } : {}),
      } satisfies StoredBook),
    );
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      throw new Error("Não há espaço no navegador para este livro. Remova um livro importado e tente de novo.");
    }
    throw e;
  }
}

export async function loadLocalBookText(id: number): Promise<string> {
  const stored = await run<StoredBook | undefined>("readonly", (s) => s.get(id));
  if (!stored) {
    throw new Error("Este livro não está mais neste aparelho. Importe o arquivo de novo.");
  }
  return stored.text;
}

/** Ilustrações do livro como endereços para <img> (chame `revoke` ao fechar o livro). */
export async function loadLocalBookImages(
  id: number,
): Promise<{ urls: Record<string, string>; revoke: () => void }> {
  const stored = await run<StoredBook | undefined>("readonly", (s) => s.get(id)).catch(() => undefined);
  const urls = Object.fromEntries(
    Object.entries(stored?.images ?? {}).map(([key, blob]) => [key, URL.createObjectURL(blob)]),
  );
  return { urls, revoke: () => Object.values(urls).forEach((u) => URL.revokeObjectURL(u)) };
}

/** Livros importados, do mais recente para o mais antigo. */
export async function listLocalBooks(): Promise<Ebook[]> {
  try {
    const all = await run<StoredBook[]>("readonly", (s) => s.getAll());
    // Só os da conta em uso neste aparelho.
    const owner = currentDataOwner();
    const legacy = legacyDataOwner();
    return all
      .filter((b) => (b.owner ?? legacy) === owner)
      .sort((a, b) => b.importedAt - a.importedAt)
      .map((b) => b.book);
  } catch {
    return [];
  }
}

export async function deleteLocalBook(id: number): Promise<void> {
  await run("readwrite", (s) => s.delete(id));
}

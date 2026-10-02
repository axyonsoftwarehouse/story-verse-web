import type { Ebook } from "../data/types";
import { currentDataOwner, legacyDataOwner } from "./dataOwner";

/**
 * Livros que o leitor importou, guardados neste navegador (IndexedDB — o localStorage não serve
 * porque um livro inteiro passa do limite dele). Com conta, a lista vai para a nuvem junto com
 * os outros dados ("storyverse:library") e os arquivos vão para o Storage (bookSync.ts): o livro
 * importado na Web aparece no app e vice-versa.
 */
const DB_NAME = "storyverse-books";
const STORE = "books";

export type StoredBook = {
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

const LIBRARY_KEY = "storyverse:library";

/**
 * Lista da conta: um item por livro importado, sem o conteúdo. Livro removido continua na lista
 * com `deletedAt`, para os outros aparelhos também removerem.
 */
export type LibraryEntry = { importedAt: number; deletedAt?: number; uploadedAt?: number; purgedAt?: number };

export function readLibrary(): Record<string, LibraryEntry> {
  try {
    return JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? "{}") as Record<string, LibraryEntry>;
  } catch {
    return {};
  }
}

export function updateLibrary(id: number, change: (e: LibraryEntry | undefined) => LibraryEntry) {
  try {
    const all = readLibrary();
    all[String(id)] = change(all[String(id)]);
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(all));
  } catch {
    // Sem espaço: o livro continua aqui, só não vai para os outros aparelhos.
  }
}

export const isRemoved = (e: LibraryEntry) => (e.deletedAt ?? 0) >= e.importedAt;

/** Grava o registro como está (livro baixado de outro aparelho). */
export async function putLocalRecord(record: StoredBook): Promise<void> {
  await run("readwrite", (s) => s.put({ ...record, ...(currentDataOwner() ? { owner: currentDataOwner() ?? undefined } : {}) }));
}

export async function getLocalRecord(id: number): Promise<StoredBook | undefined> {
  return run<StoredBook | undefined>("readonly", (s) => s.get(id));
}

/** Registros dos livros da conta em uso neste aparelho. */
export async function listLocalRecords(): Promise<StoredBook[]> {
  const all = await run<StoredBook[]>("readonly", (s) => s.getAll());
  const owner = currentDataOwner();
  const legacy = legacyDataOwner();
  return all.filter((b) => (b.owner ?? legacy) === owner);
}

export async function saveLocalBook(book: Ebook, text: string, images?: Record<string, Blob>): Promise<void> {
  const importedAt = Date.now();
  try {
    await run("readwrite", (s) =>
      s.put({
        id: book.gutenbergId,
        book,
        text,
        importedAt,
        images,
        ...(currentDataOwner() ? { owner: currentDataOwner() ?? undefined } : {}),
      } satisfies StoredBook),
    );
    updateLibrary(book.gutenbergId, () => ({ importedAt }));
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
    // Só os da conta em uso neste aparelho.
    return (await listLocalRecords())
      .sort((a, b) => b.importedAt - a.importedAt)
      .map((b) => b.book);
  } catch {
    return [];
  }
}

/** Remove o livro deste aparelho e, com `everywhere`, dos outros aparelhos da conta. */
export async function deleteLocalBook(id: number, opts: { everywhere?: boolean } = { everywhere: true }): Promise<void> {
  await run("readwrite", (s) => s.delete(id));
  if (opts.everywhere) updateLibrary(id, (e) => ({ ...(e ?? { importedAt: 0 }), deletedAt: Date.now() }));
}

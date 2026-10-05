import type { Ebook } from "../data/types";
import { currentDataOwner, legacyDataOwner } from "./dataOwner";

/**
 * Livros que o leitor importou, guardados neste navegador (IndexedDB — o localStorage não serve
 * porque um livro inteiro passa do limite dele). Com conta, a lista vai para a nuvem junto com
 * os outros dados ("storyverse:library") e os arquivos vão para o Storage (bookSync.ts): o livro
 * importado na Web aparece no app e vice-versa.
 *
 * Cada registro é chaveado por dono + id (`<dono>\u0000<id>`): duas contas no mesmo aparelho
 * podem ter o mesmo livro sem uma sobrescrever ou ler o da outra. Registros de antes da
 * separação por conta são migrados na abertura do banco (v1 → v2).
 */
const DB_NAME = "storyverse-books";
const STORE = "books";
const OWNER_INDEX = "owner";

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

type StoredBookRow = StoredBook & { key: string };

const OWNER_SEP = "\u0000";

/** Chave primária do registro: dono + id, para não colidir entre contas no mesmo aparelho. */
function keyOf(owner: string, id: number): string {
  return `${owner}${OWNER_SEP}${id}`;
}

/** Dono dos dados em uso neste aparelho ("anon" quando não há conta). */
function activeOwner(): string {
  return currentDataOwner() ?? "anon";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function createStore(db: IDBDatabase): void {
  db.createObjectStore(STORE, { keyPath: "key" }).createIndex(OWNER_INDEX, "owner");
}

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (event.oldVersion < 1) {
        createStore(db);
        return;
      }
      if (event.oldVersion < 2) {
        const tx = req.transaction;
        if (!tx) return;
        const old = tx.objectStore(STORE);
        const rows: StoredBook[] = [];
        old.openCursor().onsuccess = function () {
          const cursor = this.result;
          if (cursor) {
            rows.push(cursor.value as StoredBook);
            cursor.continue();
            return;
          }
          db.deleteObjectStore(STORE);
          createStore(db);
          const store = tx.objectStore(STORE);
          const legacy = legacyDataOwner();
          for (const row of rows) {
            const owner = row.owner ?? legacy ?? "anon";
            store.put({ ...row, owner, key: keyOf(owner, row.id) });
          }
        };
      }
    };
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
 * funcionam igual aos do acervo, sem colidir com os números do Gutenberg. O sufixo aleatório
 * evita dois livros importados no mesmo milissegundo com o mesmo id.
 */
export function newLocalBookId(): number {
  return -(Date.now() * 1000 + Math.floor(Math.random() * 1000));
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

/** Grava o registro como está (livro baixado de outro aparelho) para o dono indicado. */
export async function putLocalRecord(record: StoredBook, owner = activeOwner()): Promise<void> {
  await run("readwrite", (s) => s.put({ ...record, owner, key: keyOf(owner, record.id) } satisfies StoredBookRow));
}

export async function getLocalRecord(id: number, owner = activeOwner()): Promise<StoredBook | undefined> {
  return run<StoredBook | undefined>("readonly", (s) => s.get(keyOf(owner, id)));
}

/** Registros dos livros da conta em uso neste aparelho. */
export async function listLocalRecords(owner = activeOwner()): Promise<StoredBook[]> {
  return run<StoredBook[]>("readonly", (s) => s.index(OWNER_INDEX).getAll(owner));
}

export async function saveLocalBook(book: Ebook, text: string, images?: Record<string, Blob>): Promise<void> {
  const importedAt = Date.now();
  const owner = activeOwner();
  try {
    await run("readwrite", (s) =>
      s.put({
        key: keyOf(owner, book.gutenbergId),
        id: book.gutenbergId,
        book,
        text,
        importedAt,
        images,
        owner,
      } satisfies StoredBookRow),
    );
    updateLibrary(book.gutenbergId, () => ({ importedAt }));
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      throw new Error("Não há espaço no navegador para este livro. Remova um livro importado e tente de novo.");
    }
    throw e;
  }
}

export async function loadLocalBookText(id: number, owner = activeOwner()): Promise<string> {
  const stored = await run<StoredBook | undefined>("readonly", (s) => s.get(keyOf(owner, id)));
  if (!stored) {
    throw new Error("Este livro não está mais neste aparelho. Importe o arquivo de novo.");
  }
  return stored.text;
}

/** Ilustrações do livro como endereços para <img> (chame `revoke` ao fechar o livro). */
export async function loadLocalBookImages(
  id: number,
  owner = activeOwner(),
): Promise<{ urls: Record<string, string>; revoke: () => void }> {
  const stored = await run<StoredBook | undefined>("readonly", (s) => s.get(keyOf(owner, id))).catch(() => undefined);
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
export async function deleteLocalBook(
  id: number,
  opts: { everywhere?: boolean } = { everywhere: true },
  owner = activeOwner(),
): Promise<void> {
  await run("readwrite", (s) => s.delete(keyOf(owner, id)));
  if (opts.everywhere) updateLibrary(id, (e) => ({ ...(e ?? { importedAt: 0 }), deletedAt: Date.now() }));
}

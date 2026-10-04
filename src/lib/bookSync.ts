import { gzipSync, strToU8 } from "fflate";
import type { Ebook } from "../data/types";
import { AuthNetworkError, supabaseConfig, type SupabaseSession } from "./auth";
import { currentDataOwner } from "./dataOwner";
import { gunzipToString } from "./safeUnzip";
import {
  deleteLocalBook,
  getLocalRecord,
  isRemoved,
  listLocalRecords,
  putLocalRecord,
  readLibrary,
  updateLibrary,
  type StoredBook,
} from "./localBooks";

/**
 * Arquivos dos livros importados no Storage do Supabase (bucket privado "user-books", ver
 * supabase/user-books.sql): cada conta só lê e grava a própria pasta. O livro (texto, capa e
 * ilustrações) sobe comprimido uma vez; os outros aparelhos da conta baixam quando o veem na
 * lista ("storyverse:library", que vai junto com os outros dados em cloudSync.ts).
 */

const BUCKET = "user-books";

/** Teto do texto descomprimido do livro, para um gzip bomb não estourar a memória do aparelho. */
const MAX_UNPACKED_BYTES = 64 * 1024 * 1024;

type Packed = {
  v: 1;
  book: Ebook;
  text: string;
  importedAt: number;
  images?: Record<string, string>;
};

const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");
const pathOf = (session: SupabaseSession, id: number) => `${session.user.id}/${Math.abs(id)}.json.gz`;

async function storage(session: SupabaseSession, path: string, init: { method?: string; body?: BodyInit; headers?: Record<string, string> } = {}) {
  const { url, anonKey } = supabaseConfig();
  let res: Response;
  try {
    res = await fetch(`${url}/storage/v1/object/${path}`, {
      method: init.method ?? "GET",
      headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}`, ...init.headers },
      body: init.body,
    });
  } catch {
    throw new AuthNetworkError("Sem conexão para sincronizar os livros.");
  }
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    console.warn(`[livros] ${init.method ?? "GET"} ${path} → ${res.status}: ${payload.message ?? payload.error ?? ""}`);
    throw new Error(payload.message ?? `Erro ${res.status}`);
  }
  return res;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function pack(record: StoredBook): Promise<Uint8Array> {
  const images = record.images
    ? Object.fromEntries(await Promise.all(Object.entries(record.images).map(async ([k, b]) => [k, await blobToDataUrl(b)] as const)))
    : undefined;
  const packed: Packed = { v: 1, book: record.book, text: record.text, importedAt: record.importedAt, ...(images ? { images } : {}) };
  return gzipSync(strToU8(JSON.stringify(packed)));
}

async function unpack(bytes: Uint8Array): Promise<StoredBook> {
  const p = JSON.parse(gunzipToString(bytes, MAX_UNPACKED_BYTES)) as Packed;
  const images = p.images
    ? Object.fromEntries(await Promise.all(Object.entries(p.images).map(async ([k, url]) => [k, await (await fetch(url)).blob()] as const)))
    : undefined;
  return { id: p.book.gutenbergId, book: p.book, text: p.text, importedAt: p.importedAt, ...(images ? { images } : {}) };
}

let running: { userId: string; promise: Promise<{ local: boolean; library: boolean }> } | null = null;

async function syncBooksOnce(session: SupabaseSession): Promise<{ local: boolean; library: boolean }> {
  const owner = session.user.id;
  // Os dados em uso neste aparelho passaram a ser de outra conta (saiu ou trocou): não mistura.
  if (currentDataOwner() !== owner) return { local: false, library: false };
  let local = false;
  let library = false;
  const records = await listLocalRecords(owner);
  const here = new Map(records.map((r) => [String(r.id), r]));

  // Livros importados antes da sincronização entram na lista da conta.
  const known = readLibrary();
  for (const r of records) {
    if (!known[String(r.id)]) {
      updateLibrary(r.id, () => ({ importedAt: r.importedAt }));
      library = true;
    }
  }

  for (const [key, entry] of Object.entries(readLibrary())) {
    const id = Number(key);
    if (!Number.isFinite(id)) continue;
    try {
      if (isRemoved(entry)) {
        // Removido em algum aparelho: sai daqui e do Storage.
        if (here.has(key)) {
          await deleteLocalBook(id, { everywhere: false }, owner);
          local = true;
        }
        if (entry.uploadedAt && !entry.purgedAt) {
          await storage(session, `${BUCKET}/${encodePath(pathOf(session, id))}`, { method: "DELETE" }).catch(() => {});
          updateLibrary(id, (e) => ({ ...(e ?? entry), purgedAt: Date.now() }));
          library = true;
        }
        continue;
      }
      const record = here.get(key);
      if (record && !entry.uploadedAt) {
        await storage(session, `${BUCKET}/${encodePath(pathOf(session, id))}`, {
          method: "POST",
          headers: { "Content-Type": "application/gzip", "x-upsert": "true" },
          body: new Blob([await pack(record)], { type: "application/gzip" }),
        });
        updateLibrary(id, (e) => ({ ...(e ?? entry), uploadedAt: Date.now() }));
        library = true;
      } else if (!record && entry.uploadedAt) {
        const res = await storage(session, `authenticated/${BUCKET}/${encodePath(pathOf(session, id))}`);
        const downloaded = await unpack(new Uint8Array(await res.arrayBuffer()));
        // Removido aqui enquanto baixava: não traz de volta.
        if (isRemoved(readLibrary()[key] ?? entry) || (await getLocalRecord(id, owner))) continue;
        await putLocalRecord(downloaded, owner);
        local = true;
      }
    } catch {
      // Um livro com problema (sem espaço, rede) não impede os outros; tenta de novo depois.
    }
  }
  return { local, library };
}

/**
 * Envia os livros importados que ainda não estão na nuvem, baixa os que vieram de outro
 * aparelho e remove os que foram removidos em outro. `local`: a lista de livros daqui mudou;
 * `library`: a lista da conta mudou (precisa sincronizar de novo para os outros verem).
 */
export function syncBooks(session: SupabaseSession): Promise<{ local: boolean; library: boolean }> {
  const userId = session.user.id;
  if (running?.userId === userId) return running.promise;
  const promise = syncBooksOnce(session).finally(() => {
    if (running?.promise === promise) running = null;
  });
  running = { userId, promise };
  return promise;
}

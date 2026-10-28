import type { SupabaseSession } from "./auth";
import { ApiHttpError, AuthNetworkError } from "./backend";
import { currentDataOwner, storageForOwner } from "./dataOwner";
import {
  deleteShelfEntry,
  fetchShelfEntry,
  fetchShelfPage,
  patchShelfEntry,
  putShelfEntry,
  ShelfConflictError,
  type ShelfEntry,
  type ShelfWrite,
} from "./library";
import { mergeShelfEntry, serverTime } from "./libraryMerge";
import {
  applyServerEntry,
  forgetShelfEntry,
  rawShelfEntry,
  SHELF_CHANGED_EVENT,
  storeMergedEntry,
  takeShelfPending,
  type LocalShelfEntry,
  type ShelfPending,
} from "./libraryStore";
import { captureError } from "./telemetry";

/**
 * Sincroniza a estante com a API: primeiro sobe o que mudou aqui (PUT ao criar, PATCH só com os
 * campos pendentes, DELETE ao remover), depois desce o que mudou no servidor desde o último marco.
 * Conflito (409) passa pelas regras de libraryMerge e tenta de novo uma vez.
 */

const MARK_KEY = "storyverse:shelf-sync";
const SYNC_EVERY_MS = 30_000;
/** Volta 5 s no marco: uma gravação que terminou depois da leitura não fica para trás. */
const OVERLAP_MS = 5_000;
const EPOCH = "1970-01-01T00:00:00.000Z";

const WRITABLE = [
  "source",
  "status",
  "rating",
  "review",
  "startedOn",
  "finishedOn",
  "dnfReason",
  "dnfNote",
  "progressPercent",
  "progressLabel",
  "title",
  "author",
  "coverUrl",
  "series",
  "seriesIndex",
  "genre",
  "language",
] as const;

function fullBody(entry: ShelfEntry, baseUpdatedAt: string | null): ShelfWrite {
  const body: Record<string, unknown> = { baseUpdatedAt };
  for (const field of WRITABLE) body[field] = entry[field];
  return body as ShelfWrite;
}

function pendingBody(pending: ShelfPending, baseUpdatedAt: string | null): ShelfWrite {
  const { auto: _auto, ...values } = pending;
  void _auto;
  return { ...values, baseUpdatedAt };
}

const hasValues = (pending: ShelfPending) => Object.keys(pending).some((k) => k !== "auto");

export function readShelfSyncMark(owner: string | null = currentDataOwner()): string | null {
  try {
    return storageForOwner(owner).getItem(MARK_KEY);
  } catch {
    return null;
  }
}

function writeMark(owner: string | null, mark: string) {
  try {
    storageForOwner(owner).setItem(MARK_KEY, mark);
  } catch {
    // Sem espaço: a próxima rodada relê desde o marco anterior.
  }
}

/** Faz uma rodada completa. `false` se a rede/serviço falhou (as pendências continuam). */
export async function syncShelf(session: SupabaseSession): Promise<boolean> {
  const owner = currentDataOwner();
  // Troca de conta em andamento: os dados locais ainda são de outra conta. Não mistura.
  if (owner !== session.user.id) return false;
  try {
    for (const entry of takeShelfPending(owner)) await push(session, owner, entry);
    await pull(session, owner);
    return true;
  } catch (error) {
    if (!(error instanceof AuthNetworkError)) captureError("shelf-sync", error);
    return false;
  }
}

async function push(session: SupabaseSession, owner: string | null, entry: LocalShelfEntry): Promise<void> {
  try {
    if (entry.pendingDelete) {
      await deleteShelfEntry(session, entry.bookKey).catch((error: unknown) => {
        if (!(error instanceof ApiHttpError && error.status === 404)) throw error;
      });
      forgetShelfEntry(entry.bookKey, owner);
      return;
    }
    const saved = entry.local
      ? await putShelfEntry(session, entry.bookKey, fullBody(entry, null))
      : await patchShelfEntry(session, entry.bookKey, pendingBody(entry.pending, entry.updatedAt));
    applyServerEntry(saved, owner, entry.pendingAt);
  } catch (error) {
    if (error instanceof ShelfConflictError) return resolve(session, owner, entry, error.current);
    if (error instanceof ApiHttpError && error.status === 404) {
      // O servidor não tem mais a entrada (removida em outro aparelho): some daqui também.
      forgetShelfEntry(entry.bookKey, owner);
      return;
    }
    if (error instanceof ApiHttpError && error.status !== 403) {
      // Recusado (ex.: 422): reenviar não adianta. A entrada volta ao que o servidor tem; se nunca
      // existiu lá, sai daqui também.
      captureError("shelf-sync-rejected", error, { status: error.status });
      if (entry.local) {
        forgetShelfEntry(entry.bookKey, owner);
        return;
      }
      const server = await fetchShelfEntry(session, entry.bookKey).catch((e: unknown) => {
        if (e instanceof ApiHttpError && e.status === 404) return null;
        throw e;
      });
      if (server) storeMergedEntry(owner, server, {}, null);
      else forgetShelfEntry(entry.bookKey, owner);
      return;
    }
    // 403 (estante retirada) e falhas de rede: para a rodada e guarda tudo para depois.
    throw error;
  }
}

async function resolve(session: SupabaseSession, owner: string | null, entry: LocalShelfEntry, current: ShelfEntry | null) {
  if (!current) return;
  if (current.deletedAt) {
    // Remoção mais nova que a mudança daqui vence; mais velha, a mudança traz o livro de volta.
    if ((entry.pendingAt ?? 0) <= serverTime(current.deletedAt)) {
      forgetShelfEntry(entry.bookKey, owner);
      return;
    }
    const revived = await putShelfEntry(session, entry.bookKey, fullBody(entry, current.updatedAt)).catch(() => null);
    if (revived) applyServerEntry(revived, owner, entry.pendingAt);
    return;
  }
  const merged = mergeShelfEntry(entry, current);
  if (!hasValues(merged.pending)) {
    storeMergedEntry(owner, merged.entry, {}, null);
    return;
  }
  try {
    const saved = await patchShelfEntry(session, entry.bookKey, pendingBody(merged.pending, current.updatedAt));
    applyServerEntry(saved, owner, entry.pendingAt);
  } catch (error) {
    if (!(error instanceof ShelfConflictError)) throw error;
    // Mudou de novo no meio: guarda o merge e tenta na próxima rodada.
    storeMergedEntry(owner, merged.entry, merged.pending, entry.pendingAt);
  }
}

async function pull(session: SupabaseSession, owner: string | null): Promise<void> {
  const since = readShelfSyncMark(owner) ?? EPOCH;
  let cursor: string | undefined;
  let highWater = 0;
  let firstPage = true;
  do {
    const page = await fetchShelfPage(session, { updatedSince: since, cursor });
    for (const item of page.items) {
      if (firstPage) highWater = Math.max(highWater, serverTime(item.updatedAt));
      receive(owner, item);
    }
    firstPage = false;
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  if (highWater > 0) writeMark(owner, new Date(highWater - OVERLAP_MS).toISOString());
}

function receive(owner: string | null, item: ShelfEntry) {
  const local = rawShelfEntry(item.bookKey, owner);
  const pending = local && (hasValues(local.pending) || local.pendingDelete);
  if (item.deletedAt) {
    if (!pending || (local.pendingAt ?? 0) <= serverTime(item.deletedAt)) forgetShelfEntry(item.bookKey, owner);
    return;
  }
  // Remoção feita aqui ainda não subiu: a versão do servidor não pode "ressuscitar" a entrada.
  if (local?.pendingDelete) return;
  if (local && !pending && local.version >= item.version) return; // Já visto (sobreposição do marco).
  if (local && pending && !local.pendingDelete) {
    const merged = mergeShelfEntry(local, item);
    storeMergedEntry(owner, merged.entry, merged.pending, local.pendingAt);
    return;
  }
  applyServerEntry(item, owner, local?.pendingAt ?? null);
}

/**
 * Roda agora, a cada 30 s com o app na tela, ao voltar para ele e ao voltar a internet.
 * Rodadas não se sobrepõem. Devolve a função para parar.
 */
export function startShelfSync(session: SupabaseSession): () => void {
  let running: Promise<boolean> | null = null;
  /** Mudança feita durante uma rodada: roda de novo ao terminar, sem perder o que chegou. */
  let pending = false;
  const run = () => {
    if (running) {
      pending = true;
      return;
    }
    running = syncShelf(session).finally(() => {
      running = null;
      if (pending) {
        pending = false;
        run();
      }
    });
  };
  run();
  const timer = window.setInterval(() => document.visibilityState === "visible" && run(), SYNC_EVERY_MS);
  const onVisibility = () => document.visibilityState === "visible" && run();
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("online", run);
  // Remover/adicionar na estante precisa subir na hora; senão a ficha pública fica contraditória.
  window.addEventListener(SHELF_CHANGED_EVENT, run);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("online", run);
    window.removeEventListener(SHELF_CHANGED_EVENT, run);
  };
}

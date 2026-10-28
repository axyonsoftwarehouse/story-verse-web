import type { Ebook } from "../data/types";
import { currentDataOwner, storageForOwner } from "./dataOwner";
import {
  bookKeyOf,
  shelfSourceOf,
  todayInBrazil,
  type DnfReason,
  type ShelfEntry,
  type ShelfStatus,
} from "./library";

/**
 * Estante local-first, por conta. Cada entrada guarda o que veio do servidor e, em `pending`, os
 * campos alterados aqui que ainda não subiram (quem envia é o librarySync). `auto` marca o status
 * que nasceu do comportamento (abrir/ler), que nunca vence um "terminado" de outro aparelho.
 */

const ENTRIES_KEY = "storyverse:shelf-entries";
const PROMPTED_KEY = "storyverse:shelf-finish-prompted";

export type ShelfPending = Partial<Omit<ShelfEntry, "bookKey" | "updatedAt" | "version" | "deletedAt">> & {
  auto?: boolean;
};

export type LocalShelfEntry = ShelfEntry & {
  pending: ShelfPending;
  /** Quando houve a última alteração local ainda não enviada. */
  pendingAt: number | null;
  pendingDelete: boolean;
  /** Ainda não existe no servidor. */
  local: boolean;
  /** Última mudança vista neste aparelho (ordenar "recentes"). */
  touchedAt: number;
};

type Store = Record<string, LocalShelfEntry>;

let enabled = false;
const listeners = new Set<() => void>();

/** Liga/desliga a estante (capability `library`). Desligada, toda ação vira no-op. */
export function setShelfEnabled(on: boolean): void {
  enabled = on;
}

export function shelfEnabled(): boolean {
  return enabled;
}

export function subscribeShelf(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function read(owner: string | null): Store {
  try {
    const parsed = JSON.parse(storageForOwner(owner).getItem(ENTRIES_KEY) ?? "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function write(owner: string | null, store: Store): void {
  try {
    storageForOwner(owner).setItem(ENTRIES_KEY, JSON.stringify(store));
  } catch {
    // Sem espaço: a mudança fica só na tela até a próxima leitura.
  }
  listeners.forEach((fn) => fn());
}

/** Livros na estante (sem os removidos), do mexido mais recentemente para o mais antigo. */
export function shelfEntries(owner: string | null = currentDataOwner()): LocalShelfEntry[] {
  return Object.values(read(owner))
    .filter((e) => !e.pendingDelete && !e.deletedAt)
    .sort((a, b) => b.touchedAt - a.touchedAt);
}

export function shelfEntry(bookKey: string, owner: string | null = currentDataOwner()): LocalShelfEntry | null {
  const entry = read(owner)[bookKey];
  return entry && !entry.pendingDelete && !entry.deletedAt ? entry : null;
}

function fromBook(book: Ebook, key: string, status: ShelfStatus): LocalShelfEntry {
  return {
    bookKey: key,
    source: shelfSourceOf(book),
    status,
    rating: null,
    review: null,
    startedOn: null,
    finishedOn: null,
    dnfReason: null,
    dnfNote: null,
    progressPercent: null,
    progressLabel: null,
    title: book.title,
    author: book.author || null,
    coverUrl: book.coverUrl ?? null,
    series: null,
    seriesIndex: null,
    genre: book.genre ?? null,
    language: book.textLanguage ?? null,
    updatedAt: null,
    version: 0,
    deletedAt: null,
    pending: {},
    pendingAt: null,
    pendingDelete: false,
    local: true,
    touchedAt: Date.now(),
  };
}

/** Aplica campos à entrada e os marca como pendentes. `auto` só fica true se nada foi explícito. */
function change(store: Store, key: string, fields: ShelfPending, auto: boolean): void {
  const entry = store[key];
  if (!entry) return;
  const now = Date.now();
  const { auto: _ignored, ...values } = fields;
  void _ignored;
  store[key] = {
    ...entry,
    ...values,
    pending: { ...entry.pending, ...values, auto: (entry.pending.auto ?? true) && auto },
    pendingAt: now,
    pendingDelete: false,
    touchedAt: now,
  };
}

/** Avisa o sync que a estante mudou (ex.: para mandar a remoção na hora, sem esperar 30 s). */
export const SHELF_CHANGED_EVENT = "storyverse:shelf-changed";

/** Executa uma ação sobre a estante da conta ativa (no-op com a estante desligada). */
function mutate(fn: (store: Store) => void, notify = true): void {
  if (!enabled) return;
  const owner = currentDataOwner();
  const store = read(owner);
  fn(store);
  write(owner, store);
  // Progresso de leitura não avisa: acontece a cada rolagem e o sync periódico já o pega.
  if (notify && typeof window !== "undefined") window.dispatchEvent(new Event(SHELF_CHANGED_EVENT));
}

function ensure(store: Store, book: Ebook, status: ShelfStatus): string | null {
  const key = bookKeyOf(book);
  if (!key) return null;
  const existing = store[key];
  if (!existing || existing.pendingDelete || existing.deletedAt) {
    store[key] = { ...fromBook(book, key, status), local: !existing || existing.local };
    if (existing && !existing.local) {
      // Volta para a estante uma entrada que o servidor tem apagada: sobe inteira de novo.
      store[key] = { ...store[key], updatedAt: existing.updatedAt, version: existing.version, local: false };
    }
  }
  return key;
}

/** Abrir o livro: entra como "lendo" (ou "quero ler" vira "lendo"), sem perguntar nada. */
export function recordOpened(book: Ebook): void {
  mutate((store) => {
    const key = bookKeyOf(book);
    if (!key) return;
    const existing = store[key];
    const live = existing && !existing.pendingDelete && !existing.deletedAt;
    if (live && existing.status !== "want_to_read") return;
    ensure(store, book, "reading");
    change(store, key, { status: "reading", startedOn: store[key].startedOn ?? todayInBrazil() }, true);
  });
}

export function recordProgress(book: Ebook, percent: number, label: string): void {
  mutate((store) => {
    const key = bookKeyOf(book);
    if (!key) return;
    if (!store[key] || store[key].pendingDelete || store[key].deletedAt) {
      ensure(store, book, "reading");
      change(store, key, { status: "reading", startedOn: todayInBrazil() }, true);
    }
    const progressPercent = Math.max(0, Math.min(100, Math.round(percent)));
    change(store, key, { progressPercent, progressLabel: label.slice(0, 200) }, true);
  }, false);
}

/** Chegou ao fim do livro (ou marcou como terminado). Não muda nada se já estava terminado. */
export function recordFinished(book: Ebook): void {
  mutate((store) => {
    const key = ensure(store, book, "reading");
    if (!key || store[key].status === "finished") return;
    change(
      store,
      key,
      { status: "finished", finishedOn: todayInBrazil(), progressPercent: 100, dnfReason: null, dnfNote: null },
      false,
    );
  });
}

/** Cria a entrada com valores prontos (migração dos dados antigos). Não mexe em entrada existente. */
export function seedShelfEntry(book: Ebook, fields: ShelfPending, auto: boolean): boolean {
  let created = false;
  mutate((store) => {
    const key = bookKeyOf(book);
    if (!key || (store[key] && !store[key].pendingDelete && !store[key].deletedAt)) return;
    ensure(store, book, fields.status ?? "reading");
    change(store, key, fields, auto);
    created = true;
  });
  return created;
}

export function addToShelf(book: Ebook, status: "want_to_read"): void {
  mutate((store) => {
    const key = bookKeyOf(book);
    if (!key || (store[key] && !store[key].pendingDelete && !store[key].deletedAt)) return;
    ensure(store, book, status);
    change(store, key, { status }, false);
  });
}

function onEntry(bookKey: string, fields: (entry: LocalShelfEntry) => ShelfPending): void {
  mutate((store) => {
    const entry = store[bookKey];
    if (!entry || entry.pendingDelete || entry.deletedAt) return;
    change(store, bookKey, fields(entry), false);
  });
}

export function setRating(bookKey: string, rating: number | null): void {
  onEntry(bookKey, () => ({ rating }));
}

export function setReview(bookKey: string, review: string | null): void {
  onEntry(bookKey, () => ({ review: review?.trim() ? review.slice(0, 4000) : null }));
}

export function setDates(bookKey: string, startedOn: string | null, finishedOn: string | null): void {
  onEntry(bookKey, () => ({ startedOn, finishedOn }));
}

export function abandonBook(bookKey: string, reason: DnfReason, note: string | null): void {
  onEntry(bookKey, () => ({ status: "abandoned", dnfReason: reason, dnfNote: note?.trim() ? note.slice(0, 500) : null }));
}

/** Mudança explícita de status ("Retomar", "Quero ler", "Marcar como terminado"). */
export function setStatus(bookKey: string, status: ShelfStatus): void {
  onEntry(bookKey, (entry) => ({
    status,
    ...(status !== "abandoned" ? { dnfReason: null, dnfNote: null } : {}),
    ...(status === "finished"
      ? { finishedOn: entry.finishedOn ?? todayInBrazil(), progressPercent: 100 }
      : {}),
  }));
}

export function removeFromShelf(bookKey: string): void {
  mutate((store) => {
    const entry = store[bookKey];
    if (!entry) return;
    if (entry.local) delete store[bookKey];
    else store[bookKey] = { ...entry, pendingDelete: true, pendingAt: Date.now(), touchedAt: Date.now() };
  });
}

/** Modal de conclusão: uma vez por livro. */
export function shouldPromptFinish(bookKey: string, owner: string | null = currentDataOwner()): boolean {
  return !promptedSet(owner).has(bookKey);
}

export function markFinishPrompted(bookKey: string, owner: string | null = currentDataOwner()): void {
  const set = promptedSet(owner);
  set.add(bookKey);
  try {
    storageForOwner(owner).setItem(PROMPTED_KEY, JSON.stringify([...set]));
  } catch {
    // Sem espaço: no pior caso o modal aparece de novo.
  }
}

function promptedSet(owner: string | null): Set<string> {
  try {
    const parsed = JSON.parse(storageForOwner(owner).getItem(PROMPTED_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

/** Números para as conquistas da estante: notas, resenhas de 200+, gêneros terminados e terminados no ano. */
export function shelfAchievementInput(entries: LocalShelfEntry[], year: number) {
  const finished = entries.filter((e) => e.status === "finished");
  return {
    ratings: entries.filter((e) => e.rating !== null).length,
    reviews: entries.filter((e) => (e.review?.trim().length ?? 0) >= 200).length,
    genresFinished: new Set(finished.map((e) => e.genre).filter((g) => g && g !== "Da comunidade")).size,
    finishedThisYear: finished.filter((e) => e.finishedOn?.startsWith(`${year}-`)).length,
  };
}

// ---- Para o librarySync -------------------------------------------------------------------

/** Entradas com algo a enviar: novas, removidas ou com campos pendentes. */
export function takeShelfPending(owner: string | null): LocalShelfEntry[] {
  return Object.values(read(owner)).filter(
    (e) => e.local || e.pendingDelete || Object.keys(e.pending).some((k) => k !== "auto"),
  );
}

/**
 * Guarda o que o servidor devolveu. Se nada mudou aqui desde o envio (`sentPendingAt`), as
 * pendências somem; se mudou, as mais novas continuam por cima, para a próxima rodada.
 */
export function applyServerEntry(entry: ShelfEntry, owner: string | null, sentPendingAt: number | null): void {
  const store = read(owner);
  const current = store[entry.bookKey];
  const newer = current && current.pendingAt !== sentPendingAt ? current.pending : null;
  const { auto: _auto, ...newerValues } = newer ?? {};
  void _auto;
  store[entry.bookKey] = {
    ...entry,
    ...newerValues,
    pending: newer ?? {},
    pendingAt: newer ? (current?.pendingAt ?? null) : null,
    pendingDelete: newer ? (current?.pendingDelete ?? false) : false,
    local: false,
    touchedAt: Math.max(current?.touchedAt ?? 0, Date.now()),
  };
  write(owner, store);
}

/** Guarda o resultado de um merge (entrada a mostrar + o que ainda falta enviar). */
export function storeMergedEntry(owner: string | null, entry: ShelfEntry, pending: ShelfPending, pendingAt: number | null): void {
  const store = read(owner);
  const hasPending = Object.keys(pending).some((k) => k !== "auto");
  store[entry.bookKey] = {
    ...entry,
    pending: hasPending ? pending : {},
    pendingAt: hasPending ? pendingAt : null,
    pendingDelete: false,
    local: false,
    touchedAt: Math.max(store[entry.bookKey]?.touchedAt ?? 0, Date.now()),
  };
  write(owner, store);
}

export function forgetShelfEntry(bookKey: string, owner: string | null): void {
  const store = read(owner);
  if (!(bookKey in store)) return;
  delete store[bookKey];
  write(owner, store);
}

/** Entrada crua (inclui removidas pendentes), para o sync. */
export function rawShelfEntry(bookKey: string, owner: string | null): LocalShelfEntry | null {
  return read(owner)[bookKey] ?? null;
}

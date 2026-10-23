import type { Ebook } from "../data/types";
import type { SupabaseSession } from "./auth";
import { ApiHttpError, apiRequest } from "./backend";

/**
 * Estante (biblioteca pessoal): tipos, chave do livro e cliente de `/api/v1/me/library`.
 * Só é usada por quem tem a feature `library` (ver docs/SPEC_BIBLIOTECA_PESSOAL.md).
 */

export type ShelfStatus = "want_to_read" | "reading" | "finished" | "abandoned";
export type DnfReason = "slow" | "not_for_me" | "difficult" | "other";
export type ShelfSource = "gutenberg" | "community" | "local";

/** Uma entrada como a API devolve. Datas em `yyyy-MM-dd`; `updatedAt` é o texto do servidor. */
export type ShelfEntry = {
  bookKey: string;
  source: ShelfSource;
  status: ShelfStatus;
  rating: number | null;
  review: string | null;
  startedOn: string | null;
  finishedOn: string | null;
  dnfReason: DnfReason | null;
  dnfNote: string | null;
  progressPercent: number | null;
  progressLabel: string | null;
  title: string;
  author: string | null;
  coverUrl: string | null;
  series: string | null;
  seriesIndex: number | null;
  genre: string | null;
  language: "pt" | "en" | null;
  updatedAt: string | null;
  version: number;
  deletedAt: string | null;
};

export type ShelfStats = {
  year: number;
  finished: number;
  abandoned: number;
  reading: number;
  wantToRead: number;
  rated: number;
  averageRating: number | null;
  finishedByGenre: Record<string, number>;
  finishedByMonth: Record<string, number>;
};

/** Campos que o cliente manda num PUT/PATCH (o PATCH leva só os que mudaram). */
export type ShelfWrite = Partial<Omit<ShelfEntry, "bookKey" | "updatedAt" | "version" | "deletedAt">> & {
  baseUpdatedAt: string | null;
};

export const DNF_REASONS: { id: DnfReason; label: string }[] = [
  { id: "slow", label: "Ritmo lento" },
  { id: "not_for_me", label: "Não era para mim" },
  { id: "difficult", label: "Difícil" },
  { id: "other", label: "Outro" },
];

export function shelfSourceOf(book: Ebook): ShelfSource {
  if (book.source === "local") return "local";
  if (book.source === "community" || book.id.startsWith("cm-")) return "community";
  return "gutenberg";
}

/** `gb-1342` → `gb:1342`; `cm-<uuid>` → `cm:<uuid>`; importado → `local:<id>`. */
export function bookKeyOf(book: Ebook): string | null {
  if (book.source === "local") return Number.isInteger(book.gutenbergId) ? `local:${book.gutenbergId}` : null;
  if (/^gb-\d+$/.test(book.id)) return `gb:${book.id.slice(3)}`;
  if (/^cm-[0-9a-fA-F-]{36}$/.test(book.id)) return `cm:${book.id.slice(3)}`;
  return null;
}

const BRAZIL_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "Hoje" em `yyyy-MM-dd` no horário de Brasília (o mesmo "hoje" da API). */
export function todayInBrazil(now: Date = new Date()): string {
  return BRAZIL_DATE.format(now);
}

/** A entrada mudou desde o `baseUpdatedAt`; `current` é a versão do servidor para o merge. */
export class ShelfConflictError extends Error {
  constructor(readonly current: ShelfEntry | null) {
    super("A entrada mudou em outro aparelho.");
  }
}

const BASE = "/api/v1/me/library";
const entryPath = (bookKey: string) => `${BASE}/${encodeURIComponent(bookKey)}`;

async function write(session: SupabaseSession, method: "PUT" | "PATCH", bookKey: string, body: ShelfWrite) {
  try {
    return await apiRequest<ShelfEntry>(entryPath(bookKey), { method, body, accessToken: session.access_token });
  } catch (error) {
    if (error instanceof ApiHttpError && error.status === 409) {
      throw new ShelfConflictError((error.body.current as ShelfEntry | null | undefined) ?? null);
    }
    throw error;
  }
}

export function putShelfEntry(session: SupabaseSession, bookKey: string, body: ShelfWrite): Promise<ShelfEntry> {
  return write(session, "PUT", bookKey, body);
}

export function patchShelfEntry(session: SupabaseSession, bookKey: string, body: ShelfWrite): Promise<ShelfEntry> {
  return write(session, "PATCH", bookKey, body);
}

export async function deleteShelfEntry(session: SupabaseSession, bookKey: string): Promise<void> {
  await apiRequest(entryPath(bookKey), { method: "DELETE", accessToken: session.access_token });
}

export function fetchShelfPage(
  session: SupabaseSession,
  params: { updatedSince?: string; cursor?: string; limit?: number } = {},
): Promise<{ items: ShelfEntry[]; nextCursor: string | null }> {
  const query = new URLSearchParams();
  if (params.updatedSince) query.set("updatedSince", params.updatedSince);
  if (params.cursor) query.set("cursor", params.cursor);
  query.set("limit", String(params.limit ?? 100));
  return apiRequest(`${BASE}?${query}`, { accessToken: session.access_token });
}

export function fetchShelfStats(session: SupabaseSession, year?: number): Promise<ShelfStats> {
  return apiRequest(`${BASE}/stats${year ? `?year=${year}` : ""}`, { accessToken: session.access_token });
}

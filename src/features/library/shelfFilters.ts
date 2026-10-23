import type { ShelfStatus } from "../../lib/library";
import type { LocalShelfEntry } from "../../lib/libraryStore";

export type ShelfFilter = {
  status?: ShelfStatus;
  author?: string;
  series?: string;
  genre?: string;
  minRating?: number;
  year?: number;
  /** true: só os que abrem neste aparelho; false: só os sem arquivo. */
  hasFile?: boolean;
};

export type ShelfSort = "recent" | "title" | "author" | "rating" | "finished";

/** Rótulo do acervo da comunidade; não é um gênero de verdade. */
export const COMMUNITY_GENRE = "Da comunidade";

const same = (a: string | null, b: string) => (a ?? "").toLocaleLowerCase("pt-BR") === b.toLocaleLowerCase("pt-BR");
const byText = (a: string | null, b: string | null) => {
  if (!a) return b ? 1 : 0;
  if (!b) return -1;
  return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
};
/** Maior primeiro; vazios no fim. */
function desc(a: string | number | null, b: string | number | null): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return a < b ? 1 : a > b ? -1 : 0;
}

export function filterShelf(
  entries: LocalShelfEntry[],
  f: ShelfFilter,
  sort: ShelfSort,
  available: (bookKey: string) => boolean,
): LocalShelfEntry[] {
  const out = entries.filter((e) => {
    if (f.status && e.status !== f.status) return false;
    if (f.author && !same(e.author, f.author)) return false;
    if (f.series && !same(e.series, f.series)) return false;
    if (f.genre && (e.genre !== f.genre || e.genre === COMMUNITY_GENRE)) return false;
    if (f.minRating !== undefined && (e.rating ?? 0) < f.minRating) return false;
    if (f.year !== undefined && !e.finishedOn?.startsWith(`${f.year}-`)) return false;
    if (f.hasFile !== undefined && available(e.bookKey) !== f.hasFile) return false;
    return true;
  });
  const compare: Record<ShelfSort, (a: LocalShelfEntry, b: LocalShelfEntry) => number> = {
    recent: (a, b) => b.touchedAt - a.touchedAt,
    title: (a, b) => byText(a.title, b.title),
    author: (a, b) => byText(a.author, b.author),
    rating: (a, b) => desc(a.rating, b.rating),
    finished: (a, b) => desc(a.finishedOn, b.finishedOn),
  };
  return out.sort((a, b) => compare[sort](a, b) || byText(a.title, b.title));
}

/** Valores distintos para os seletores (autor, gênero, ano). */
export function shelfOptions(entries: LocalShelfEntry[]) {
  const sorted = (values: (string | null)[]) =>
    [...new Set(values.filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return {
    authors: sorted(entries.map((e) => e.author)),
    genres: sorted(entries.map((e) => (e.genre === COMMUNITY_GENRE ? null : e.genre))),
    years: [...new Set(entries.map((e) => e.finishedOn?.slice(0, 4)).filter((y): y is string => Boolean(y)))]
      .sort()
      .reverse(),
  };
}

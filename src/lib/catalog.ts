import type { Ebook } from "../data/types";
import type { SupabaseSession } from "./auth";
import { apiFetch, apiRequest } from "./backend";

/**
 * Biblioteca pública: catálogo curado da API (`/api/v1/catalog/...`). Metadados são abertos;
 * abrir o texto exige sessão. A estante guarda esses livros como `cat:<uuid>`.
 */

export type CatalogRights = "public_domain" | "own_work" | "free_license";

const RIGHTS_LABELS: Record<CatalogRights, string> = {
  public_domain: "Domínio público",
  own_work: "Obra própria",
  free_license: "Licença livre",
};

export function catalogRightsLabel(rights: CatalogRights | undefined): string {
  return rights ? RIGHTS_LABELS[rights] : "";
}

export type CatalogBook = {
  book_key: string;
  title: string;
  author: string | null;
  genre: string | null;
  language: "pt" | "en";
  series: string | null;
  series_index: number | null;
  description: string | null;
  page_count: number | null;
  cover_url: string | null;
  featured: boolean;
  published_at: string | null;
  rights?: CatalogRights;
  rights_note?: string | null;
  /** Coleções publicadas em que o livro aparece (vem no detalhe). */
  collections?: { id: string; slug: string; title: string }[];
};

export type CatalogCollection = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  sort_order: number;
  book_count: number;
  books: CatalogBook[];
};

export type CatalogPage = {
  items: CatalogBook[];
  page: number;
  limit: number;
};

export type CatalogSort = "new" | "title" | "author" | "featured";

export type CatalogQuery = {
  q?: string;
  genre?: string;
  language?: "pt" | "en" | "";
  author?: string;
  collection?: string;
  featured?: boolean;
  sort?: CatalogSort;
  page?: number;
  limit?: number;
};

/** Hash estável da chave para o progresso local (o leitor usa `gutenbergId` como chave). */
export function catalogNumericId(bookKey: string): number {
  let hash = 0;
  for (const char of bookKey) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return 1_000_000_000 + (hash % 900_000_000);
}

/** `cat:<uuid>` → `cat-<uuid>` (id estável no app) e vice-versa. */
export function catalogBookId(bookKey: string): string {
  return `cat-${bookKey.replace(/^cat:/, "")}`;
}

export function catalogBookToEbook(book: CatalogBook): Ebook {
  return {
    id: catalogBookId(book.book_key),
    gutenbergId: catalogNumericId(book.book_key),
    title: book.title,
    author: book.author || "Autor não informado",
    genre: book.genre ?? undefined,
    blurb: book.description ?? undefined,
    coverUrl: book.cover_url ?? undefined,
    textLanguage: book.language,
    source: "catalog",
    catalogKey: book.book_key,
    publishedAt: book.published_at ?? undefined,
  };
}

export function searchCatalog(query: CatalogQuery = {}): Promise<CatalogPage> {
  const params = new URLSearchParams();
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.genre?.trim()) params.set("genre", query.genre.trim());
  if (query.language) params.set("language", query.language);
  if (query.author?.trim()) params.set("author", query.author.trim());
  if (query.collection?.trim()) params.set("collection", query.collection.trim());
  if (query.featured !== undefined) params.set("featured", String(query.featured));
  if (query.sort && query.sort !== "new") params.set("sort", query.sort);
  params.set("page", String(Math.max(0, query.page ?? 0)));
  params.set("limit", String(Math.min(Math.max(1, query.limit ?? 20), 50)));
  return apiRequest<CatalogPage>(`/api/v1/catalog/books?${params.toString()}`);
}

export function getCatalogBook(bookKey: string): Promise<CatalogBook> {
  return apiRequest<CatalogBook>(`/api/v1/catalog/books/${encodeURIComponent(bookKey)}`);
}

export function listCatalogCollections(): Promise<CatalogCollection[]> {
  return apiRequest<CatalogCollection[]>("/api/v1/catalog/collections");
}

export function getCatalogCollection(slug: string): Promise<CatalogCollection> {
  return apiRequest<CatalogCollection>(`/api/v1/catalog/collections/${encodeURIComponent(slug)}`);
}

/** Texto do livro para o leitor; exige sessão (o servidor recusa anônimo com 401). */
export async function fetchCatalogBookText(
  session: SupabaseSession | null,
  bookKey: string,
): Promise<string> {
  const res = await apiFetch(`/api/v1/catalog/books/${encodeURIComponent(bookKey)}/text`, {
    accessToken: session?.access_token,
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(payload.error ?? payload.message ?? "Não foi possível abrir o texto do livro.");
  }
  return res.text();
}

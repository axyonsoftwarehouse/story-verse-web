import type { SupabaseSession } from "./auth";
import { ApiHttpError, apiFetch, apiRequest } from "./backend";

/**
 * Catálogo público curado (API própria, migração V17). O admin vê o acervo inteiro, inclusive
 * rascunhos e ocultos; a biblioteca pública só enxerga `published`.
 */

export type CatalogRights = "public_domain" | "own_work" | "free_license";
export type CatalogStatus = "draft" | "published" | "hidden" | "archived";
export type CatalogSource = "admin" | "community" | "import";

export type AdminCatalogBook = {
  id: string;
  book_key: string;
  source: CatalogSource;
  submission_id: string | null;
  title: string;
  author: string | null;
  genre: string | null;
  language: "pt" | "en";
  series: string | null;
  series_index: number | null;
  description: string | null;
  page_count: number | null;
  rights: CatalogRights;
  rights_note: string | null;
  storage_bucket: string;
  text_path: string;
  original_path: string | null;
  original_content_type: string | null;
  char_count: number | null;
  checksum: string | null;
  cover_url: string | null;
  status: CatalogStatus;
  featured: boolean;
  sort_order: number;
  duplicate_of: string | null;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CatalogPage = {
  items: AdminCatalogBook[];
  page: number;
  limit: number;
};

export type CatalogFilters = {
  q?: string;
  status?: CatalogStatus | "";
  genre?: string;
  language?: "pt" | "en" | "";
  source?: CatalogSource | "";
  featured?: boolean;
};

export type CatalogBookInput = {
  title: string;
  author?: string;
  genre?: string;
  language: "pt" | "en";
  series?: string;
  seriesIndex?: number | null;
  description?: string;
  pageCount?: number;
  rights: CatalogRights;
  rightsNote?: string;
  coverUrl?: string | null;
  status?: "draft" | "published";
  featured?: boolean;
  sortOrder?: number;
};

export type CatalogUpload = {
  path: string;
  contentType: string;
};

export const MAX_CATALOG_BYTES = 50 * 1024 * 1024;

/** O `<input type="file">` aceita só o que o bucket `catalog-books` e o extrator entendem. */
export const CATALOG_ACCEPT =
  ".txt,.md,.markdown,.pdf,.epub,text/plain,text/markdown,application/pdf,application/epub+zip";

const STATUS_LABELS: Record<CatalogStatus, string> = {
  draft: "Rascunho",
  published: "Publicado",
  hidden: "Oculto",
  archived: "Arquivado",
};

const SOURCE_LABELS: Record<CatalogSource, string> = {
  admin: "Cadastrado no admin",
  community: "Enviado pela comunidade",
  import: "Importado em lote",
};

const RIGHTS_LABELS: Record<CatalogRights, string> = {
  public_domain: "Domínio público",
  own_work: "Obra própria",
  free_license: "Licença livre",
};

export const CATALOG_GENRES = [
  "Clássico",
  "Romance",
  "Aventura",
  "Conto",
  "Poesia",
  "Terror",
  "Fantasia",
  "Ficção científica",
  "Mistério",
  "Biografia",
  "Infantil",
  "Ensaio",
];

export function catalogStatusLabel(status: CatalogStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function catalogSourceLabel(source: CatalogSource): string {
  return SOURCE_LABELS[source] ?? source;
}

export function catalogRightsLabel(rights: CatalogRights): string {
  return RIGHTS_LABELS[rights] ?? rights;
}

/** Classe do `status-chip` conforme a situação. */
export function catalogStatusTone(status: CatalogStatus): string {
  if (status === "published") return "is-approved";
  if (status === "draft") return "is-pending";
  if (status === "archived") return "is-archived";
  return "is-hidden";
}

export function isDuplicateBookError(error: unknown): boolean {
  return error instanceof ApiHttpError && error.code === "DUPLICATE_BOOK";
}

/** Data curta em pt-BR; "—" quando não existe. */
export function catalogDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function catalogChars(chars: number | null): string {
  if (!chars) return "—";
  return `${chars.toLocaleString("pt-BR")} caracteres`;
}

/** Validações compartilhadas entre o cadastro em etapas e a edição. */
export function catalogMetadataProblem(value: {
  title: string;
  seriesIndex: string;
  pageCount: string;
}): string {
  if (value.title.trim().length < 2) return "Informe o título do livro.";
  if (value.seriesIndex.trim()) {
    const index = Number(value.seriesIndex);
    if (!Number.isFinite(index) || index < 0) return "O volume da série precisa ser um número.";
  }
  if (value.pageCount.trim()) {
    const pages = Number(value.pageCount);
    if (!Number.isInteger(pages) || pages < 0) return "O número de páginas precisa ser inteiro.";
  }
  return "";
}

export function catalogRightsProblem(value: {
  rights: CatalogRights;
  rightsNote: string;
}): string {
  if (value.rights !== "public_domain" && value.rightsNote.trim().length < 3) {
    return "Explique por que esta obra pode ser publicada (autorização, obra própria ou licença).";
  }
  return "";
}

type UploadKind = { contentType: string; extension: string };

/**
 * Formato pelo nome do arquivo (não pelo `File.type`, que o navegador às vezes manda vazio ou
 * errado). Markdown sobe como `text/plain`: é o tipo que o bucket aceita e o extrator lê.
 */
export function catalogUploadKind(file: File): UploadKind {
  const name = file.name.toLowerCase();
  const extension = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  if (extension === ".txt") return { contentType: "text/plain", extension: ".txt" };
  if (extension === ".md" || extension === ".markdown") {
    return { contentType: "text/plain", extension: ".md" };
  }
  if (extension === ".pdf") return { contentType: "application/pdf", extension: ".pdf" };
  if (extension === ".epub") return { contentType: "application/epub+zip", extension: ".epub" };
  throw new Error("Formato de arquivo não aceito. Envie TXT, MD, EPUB ou PDF.");
}

/** Valida o arquivo antes de qualquer upload (o servidor confere de novo). */
export function checkCatalogFile(file: File): UploadKind {
  if (file.size === 0) throw new Error("O arquivo está vazio.");
  if (file.size > MAX_CATALOG_BYTES) throw new Error("Arquivo grande demais (máximo de 50 MB).");
  return catalogUploadKind(file);
}

function storageError(message: string | undefined, status: number): string {
  if (status === 413) return "Arquivo grande demais (máximo de 50 MB).";
  if (status === 415) return "Formato de arquivo não aceito. Envie TXT, MD, EPUB ou PDF.";
  if (status === 403) return "Sem permissão para enviar este arquivo.";
  return message || "Não foi possível enviar o arquivo.";
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export const catalogErrorMessage = errorMessage;

export function listCatalogBooks(
  session: SupabaseSession,
  filters: CatalogFilters,
  page = 0,
  limit = 20,
): Promise<CatalogPage> {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.status) params.set("status", filters.status);
  if (filters.genre?.trim()) params.set("genre", filters.genre.trim());
  if (filters.language) params.set("language", filters.language);
  if (filters.source) params.set("source", filters.source);
  if (filters.featured !== undefined) params.set("featured", String(filters.featured));
  params.set("page", String(Math.max(0, page)));
  params.set("limit", String(Math.min(Math.max(1, limit), 50)));
  return apiRequest<CatalogPage>(`/api/v1/admin/catalog/books?${params.toString()}`, {
    accessToken: session.access_token,
  });
}

export function getCatalogBook(
  session: SupabaseSession,
  id: string,
): Promise<AdminCatalogBook> {
  return apiRequest<AdminCatalogBook>(`/api/v1/admin/catalog/books/${encodeURIComponent(id)}`, {
    accessToken: session.access_token,
  });
}

export async function uploadCatalogOriginal(
  session: SupabaseSession,
  file: File,
): Promise<CatalogUpload> {
  const kind = checkCatalogFile(file);
  const path = `${session.user.id}/${crypto.randomUUID()}${kind.extension}`;
  const res = await apiFetch(
    `/api/v1/storage/catalog-books/object?path=${encodeURIComponent(path)}`,
    {
      method: "POST",
      accessToken: session.access_token,
      body: file,
      headers: { "Content-Type": kind.contentType },
    },
  );
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(storageError(payload.error ?? payload.message, res.status));
  }
  return { path, contentType: kind.contentType };
}

export function createCatalogBook(
  session: SupabaseSession,
  input: CatalogBookInput,
  original: CatalogUpload,
  options: { allowDuplicate?: boolean } = {},
): Promise<AdminCatalogBook> {
  const body: Record<string, unknown> = {
    title: input.title.trim(),
    language: input.language,
    rights: input.rights,
    originalPath: original.path,
    originalContentType: original.contentType,
    status: input.status ?? "draft",
    featured: input.featured ?? false,
    sortOrder: input.sortOrder ?? 0,
    allowDuplicate: options.allowDuplicate ?? false,
  };
  if (input.author?.trim()) body.author = input.author.trim();
  if (input.genre?.trim()) body.genre = input.genre.trim();
  if (input.series?.trim()) body.series = input.series.trim();
  if (input.seriesIndex !== undefined) body.seriesIndex = input.seriesIndex;
  if (input.description?.trim()) body.description = input.description.trim();
  if (input.pageCount !== undefined) body.pageCount = input.pageCount;
  if (input.rightsNote?.trim()) body.rightsNote = input.rightsNote.trim();
  if (input.coverUrl) body.coverUrl = input.coverUrl;
  return apiRequest<AdminCatalogBook>("/api/v1/admin/catalog/books", {
    method: "POST",
    accessToken: session.access_token,
    body,
  });
}

export function updateCatalogBook(
  session: SupabaseSession,
  id: string,
  input: CatalogBookInput,
): Promise<AdminCatalogBook> {
  const body: Record<string, unknown> = {
    title: input.title.trim(),
    author: input.author?.trim() || null,
    genre: input.genre?.trim() || null,
    language: input.language,
    series: input.series?.trim() || null,
    seriesIndex: input.seriesIndex ?? null,
    description: input.description?.trim() || null,
    rights: input.rights,
    rightsNote: input.rightsNote?.trim() || null,
    coverUrl: input.coverUrl ?? null,
    featured: input.featured ?? false,
    sortOrder: input.sortOrder ?? 0,
  };
  // Só manda o número de páginas quando ele existe: o servidor usa 0 como padrão e apagaria o valor.
  if (input.pageCount !== undefined) body.pageCount = input.pageCount;
  return apiRequest<AdminCatalogBook>(`/api/v1/admin/catalog/books/${encodeURIComponent(id)}`, {
    method: "PATCH",
    accessToken: session.access_token,
    body,
  });
}

export function updateCatalogBookCover(
  session: SupabaseSession,
  id: string,
  coverUrl: string | null,
): Promise<AdminCatalogBook> {
  return apiRequest<AdminCatalogBook>(`/api/v1/admin/catalog/books/${encodeURIComponent(id)}`, {
    method: "PATCH",
    accessToken: session.access_token,
    body: { coverUrl },
  });
}

export function replaceCatalogBookText(
  session: SupabaseSession,
  id: string,
  original: CatalogUpload,
): Promise<AdminCatalogBook> {
  return apiRequest<AdminCatalogBook>(
    `/api/v1/admin/catalog/books/${encodeURIComponent(id)}/text`,
    {
      method: "POST",
      accessToken: session.access_token,
      body: { originalPath: original.path, originalContentType: original.contentType },
    },
  );
}

export function setCatalogBookStatus(
  session: SupabaseSession,
  id: string,
  action: "publish" | "hide" | "archive",
): Promise<AdminCatalogBook> {
  return apiRequest<AdminCatalogBook>(
    `/api/v1/admin/catalog/books/${encodeURIComponent(id)}/${action}`,
    { method: "POST", accessToken: session.access_token },
  );
}

export function deleteCatalogBook(session: SupabaseSession, id: string): Promise<void> {
  return apiRequest<void>(`/api/v1/admin/catalog/books/${encodeURIComponent(id)}`, {
    method: "DELETE",
    accessToken: session.access_token,
  });
}

/**
 * Texto do livro para a prévia do admin. Usa o storage (o backend deixa moderador ler
 * `catalog-books`), então funciona para rascunho, oculto e arquivado — não só para publicado.
 */
export async function fetchCatalogText(
  session: SupabaseSession,
  book: Pick<AdminCatalogBook, "storage_bucket" | "text_path">,
): Promise<string> {
  const res = await apiFetch(
    `/api/v1/storage/${book.storage_bucket}/object?path=${encodeURIComponent(book.text_path)}`,
    { accessToken: session.access_token },
  );
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(payload.error ?? payload.message ?? "Não foi possível abrir o texto.");
  }
  return res.text();
}

// ---- Coleções -----------------------------------------------------------------------------

export type CatalogCollectionStatus = "draft" | "published" | "hidden";

export type CatalogCollectionBook = {
  id: string;
  book_key: string;
  title: string;
  author: string | null;
  status: CatalogStatus;
  source: CatalogSource;
};

export type AdminCatalogCollection = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: CatalogCollectionStatus;
  sort_order: number;
  book_count?: number;
  created_at: string;
  updated_at: string;
  books?: CatalogCollectionBook[];
};

export type CatalogCollectionInput = {
  slug: string;
  title: string;
  description?: string;
  status: CatalogCollectionStatus;
  sortOrder?: number;
};

const COLLECTION_STATUSES: Record<CatalogCollectionStatus, string> = {
  draft: "Rascunho",
  published: "Publicada",
  hidden: "Oculta",
};

export function collectionStatusLabel(status: CatalogCollectionStatus): string {
  return COLLECTION_STATUSES[status] ?? status;
}

export function collectionStatusTone(status: CatalogCollectionStatus): string {
  if (status === "published") return "is-approved";
  if (status === "draft") return "is-pending";
  return "is-hidden";
}

export function listCatalogCollections(
  session: SupabaseSession,
): Promise<AdminCatalogCollection[]> {
  return apiRequest<AdminCatalogCollection[]>(
    "/api/v1/admin/catalog/collections",
    { accessToken: session.access_token },
  );
}

export function getCatalogCollection(
  session: SupabaseSession,
  id: string,
): Promise<AdminCatalogCollection> {
  return apiRequest<AdminCatalogCollection>(
    `/api/v1/admin/catalog/collections/${encodeURIComponent(id)}`,
    { accessToken: session.access_token },
  );
}

export function createCatalogCollection(
  session: SupabaseSession,
  input: CatalogCollectionInput,
): Promise<AdminCatalogCollection> {
  return apiRequest<AdminCatalogCollection>(
    "/api/v1/admin/catalog/collections",
    { method: "POST", accessToken: session.access_token, body: collectionBody(input) },
  );
}

export function updateCatalogCollection(
  session: SupabaseSession,
  id: string,
  input: CatalogCollectionInput,
): Promise<AdminCatalogCollection> {
  return apiRequest<AdminCatalogCollection>(
    `/api/v1/admin/catalog/collections/${encodeURIComponent(id)}`,
    { method: "PATCH", accessToken: session.access_token, body: collectionBody(input) },
  );
}

export function deleteCatalogCollection(session: SupabaseSession, id: string): Promise<void> {
  return apiRequest<void>(
    `/api/v1/admin/catalog/collections/${encodeURIComponent(id)}`,
    { method: "DELETE", accessToken: session.access_token },
  );
}

export function setCatalogCollectionBooks(
  session: SupabaseSession,
  id: string,
  bookIds: string[],
): Promise<AdminCatalogCollection> {
  return apiRequest<AdminCatalogCollection>(
    `/api/v1/admin/catalog/collections/${encodeURIComponent(id)}/books`,
    { method: "PUT", accessToken: session.access_token, body: { bookIds } },
  );
}

function collectionBody(input: CatalogCollectionInput): Record<string, unknown> {
  return {
    slug: input.slug.trim().toLowerCase(),
    title: input.title.trim(),
    description: input.description?.trim() || null,
    status: input.status,
    sortOrder: input.sortOrder ?? 0,
  };
}

// ---- Importação em lote -------------------------------------------------------------------

export const MAX_IMPORT_BYTES = 200 * 1024 * 1024;

export const CATALOG_IMPORT_ACCEPT = ".zip,application/zip,application/x-zip-compressed";

export type CatalogImportItemStatus = "ok" | "imported" | "skipped" | "error";

export type CatalogImportItem = {
  line: number | null;
  /** Prévia e detalhe usam `fileName`; as linhas cruas do banco usam `file_name`. */
  fileName?: string;
  file_name?: string;
  status: CatalogImportItemStatus;
  message: string | null;
  bookKey?: string | null;
  catalog_book_id?: string | null;
};

export type CatalogImportPreview = {
  dryRun: true;
  total: number;
  items: CatalogImportItem[];
};

export type CatalogImportRecord = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  file_name: string;
  total: number;
  imported: number;
  skipped: number;
  error: string | null;
  created_at: string;
  finished_at: string | null;
  items?: CatalogImportItem[];
};

export type CatalogImportResult = CatalogImportPreview | CatalogImportRecord;

export function catalogImportFileName(item: CatalogImportItem): string {
  return item.fileName ?? item.file_name ?? "—";
}

export function catalogImportStatusLabel(status: CatalogImportItemStatus | string): string {
  if (status === "ok") return "Pronto";
  if (status === "imported") return "Importado";
  if (status === "skipped") return "Pulado";
  if (status === "error") return "Erro";
  return status;
}

export async function uploadCatalogImportArchive(
  session: SupabaseSession,
  file: File,
): Promise<{ path: string; fileName: string }> {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".zip")) throw new Error("Escolha um arquivo .zip.");
  if (file.size === 0) throw new Error("O arquivo ZIP está vazio.");
  if (file.size > MAX_IMPORT_BYTES) throw new Error("Pacote grande demais (máximo de 200 MB).");
  const path = `${session.user.id}/imports/${crypto.randomUUID()}.zip`;
  const res = await apiFetch(
    `/api/v1/storage/catalog-imports/object?path=${encodeURIComponent(path)}`,
    {
      method: "POST",
      accessToken: session.access_token,
      body: file,
      headers: { "Content-Type": "application/zip" },
    },
  );
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(
      res.status === 413
        ? "Pacote grande demais (máximo de 200 MB)."
        : payload.error ?? payload.message ?? "Não foi possível enviar o pacote.",
    );
  }
  return { path, fileName: file.name };
}

export function runCatalogImport(
  session: SupabaseSession,
  input: { archivePath: string; fileName: string; dryRun: boolean },
): Promise<CatalogImportResult> {
  return apiRequest<CatalogImportResult>("/api/v1/admin/catalog/imports", {
    method: "POST",
    accessToken: session.access_token,
    body: input,
    timeoutMs: 120_000,
  });
}

export function listCatalogImports(session: SupabaseSession): Promise<CatalogImportRecord[]> {
  return apiRequest<CatalogImportRecord[]>("/api/v1/admin/catalog/imports", {
    accessToken: session.access_token,
  });
}

export function getCatalogImport(
  session: SupabaseSession,
  id: string,
): Promise<CatalogImportRecord> {
  return apiRequest<CatalogImportRecord>(
    `/api/v1/admin/catalog/imports/${encodeURIComponent(id)}`,
    { accessToken: session.access_token },
  );
}

/** CSV de erros/pulados: o conteúdo é pequeno, então vem como texto para baixar. */
export async function fetchCatalogImportErrors(
  session: SupabaseSession,
  id: string,
): Promise<string> {
  const res = await apiFetch(
    `/api/v1/admin/catalog/imports/${encodeURIComponent(id)}/errors.csv`,
    { accessToken: session.access_token },
  );
  if (!res.ok) throw new Error("Não foi possível baixar o relatório.");
  return res.text();
}


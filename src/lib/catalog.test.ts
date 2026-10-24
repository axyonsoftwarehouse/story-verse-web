import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "./auth";
import { apiFetch, apiRequest } from "./backend";
import {
  catalogBookId,
  catalogBookToEbook,
  catalogNumericId,
  fetchCatalogBookText,
  getCatalogBook,
  searchCatalog,
  type CatalogBook,
} from "./catalog";

vi.mock("./backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./backend")>();
  return { ...actual, apiRequest: vi.fn(), apiFetch: vi.fn() };
});

const book: CatalogBook = {
  book_key: "cat:0f8fad5b-d9cb-469f-a165-70867728950e",
  title: "Dom Casmurro",
  author: "Machado de Assis",
  genre: "Clássico",
  language: "pt",
  series: null,
  series_index: null,
  description: "Um clássico.",
  page_count: 256,
  cover_url: "https://example.test/capa.jpg",
  featured: true,
  published_at: "2026-10-20T12:00:00Z",
  rights: "public_domain",
};

const session = { access_token: "token" } as SupabaseSession;

describe("catálogo público", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
    vi.mocked(apiFetch).mockReset();
  });

  it("monta um Ebook estável a partir do livro do catálogo", () => {
    const ebook = catalogBookToEbook(book);
    expect(ebook.id).toBe(catalogBookId(book.book_key));
    expect(ebook.gutenbergId).toBe(catalogNumericId(book.book_key));
    expect(ebook.source).toBe("catalog");
    expect(ebook.catalogKey).toBe(book.book_key);
    expect(ebook.textLanguage).toBe("pt");
    expect(ebook.coverUrl).toBe(book.cover_url);
    expect(ebook.blurb).toBe(book.description);
  });

  it("busca com filtros e não manda a ordenação padrão", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ items: [], page: 0, limit: 20 });
    await searchCatalog({ q: " machado ", genre: "Clássico", language: "pt", featured: true, page: 1, limit: 10 });
    const url = vi.mocked(apiRequest).mock.calls[0][0];
    expect(url).toContain("/api/v1/catalog/books?");
    expect(url).toContain("q=machado");
    expect(url).toContain("genre=Cl%C3%A1ssico");
    expect(url).toContain("language=pt");
    expect(url).toContain("featured=true");
    expect(url).toContain("page=1");
    expect(url).toContain("limit=10");
    expect(url).not.toContain("sort=");
  });

  it("manda a ordenação quando não é a padrão", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ items: [], page: 0, limit: 20 });
    await searchCatalog({ sort: "title" });
    expect(vi.mocked(apiRequest).mock.calls[0][0]).toContain("sort=title");
  });

  it("abre o detalhe pela chave codificada", async () => {
    vi.mocked(apiRequest).mockResolvedValue(book);
    await getCatalogBook(book.book_key);
    expect(vi.mocked(apiRequest).mock.calls[0][0]).toBe(
      "/api/v1/catalog/books/cat%3A0f8fad5b-d9cb-469f-a165-70867728950e",
    );
  });

  it("lê o texto com a sessão", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ ok: true, text: async () => "Era uma vez" } as Response);
    const text = await fetchCatalogBookText(session, book.book_key);
    expect(text).toBe("Era uma vez");
    const [url, init] = vi.mocked(apiFetch).mock.calls[0];
    expect(url).toContain("/api/v1/catalog/books/cat%3A0f8fad5b");
    expect(init?.accessToken).toBe("token");
  });

  it("explica a falha ao abrir o texto", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Entre para ler." }),
    } as Response);
    await expect(fetchCatalogBookText(null, book.book_key)).rejects.toThrow("Entre para ler.");
  });
});

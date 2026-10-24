import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "./auth";
import { apiFetch, apiRequest } from "./backend";
import {
  catalogStatusLabel,
  catalogStatusTone,
  catalogUploadKind,
  checkCatalogFile,
  createCatalogBook,
  fetchCatalogText,
  listCatalogBooks,
  updateCatalogBook,
  uploadCatalogOriginal,
} from "./adminCatalog";

vi.mock("./backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./backend")>();
  return { ...actual, apiRequest: vi.fn(), apiFetch: vi.fn() };
});

const session = {
  access_token: "token",
  user: { id: "admin-1" },
} as unknown as SupabaseSession;

function file(name: string, type = "", bytes = 10): File {
  return new File(["x".repeat(bytes)], name, { type });
}

describe("adminCatalog", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
    vi.mocked(apiFetch).mockReset();
  });

  it("reconhece os formatos aceitos e recusa o resto", () => {
    expect(catalogUploadKind(file("livro.txt"))).toEqual({
      contentType: "text/plain",
      extension: ".txt",
    });
    expect(catalogUploadKind(file("livro.md"))).toEqual({
      contentType: "text/plain",
      extension: ".md",
    });
    expect(catalogUploadKind(file("livro.epub"))).toEqual({
      contentType: "application/epub+zip",
      extension: ".epub",
    });
    expect(catalogUploadKind(file("livro.pdf"))).toEqual({
      contentType: "application/pdf",
      extension: ".pdf",
    });
    expect(() => catalogUploadKind(file("livro.docx"))).toThrow(/Formato/);
    expect(() => checkCatalogFile(file("livro.txt", "", 0))).toThrow(/vazio/);
  });

  it("lista o catálogo com filtros e paginação", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ items: [], page: 0, limit: 20 });
    await listCatalogBooks(session, { q: " machado ", status: "draft", featured: true }, 2, 10);
    const url = vi.mocked(apiRequest).mock.calls[0][0];
    expect(url).toContain("/api/v1/admin/catalog/books?");
    expect(url).toContain("q=machado");
    expect(url).toContain("status=draft");
    expect(url).toContain("featured=true");
    expect(url).toContain("page=2");
    expect(url).toContain("limit=10");
  });

  it("sobe o original no bucket do catálogo com o tipo certo", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ ok: true } as Response);
    const upload = await uploadCatalogOriginal(session, file("livro.md"));
    expect(upload.contentType).toBe("text/plain");
    expect(upload.path).toMatch(/^admin-1\/[0-9a-f-]+\.md$/);
    const [url, init] = vi.mocked(apiFetch).mock.calls[0];
    expect(url).toContain("/api/v1/storage/catalog-books/object?path=");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "Content-Type": "text/plain" });
  });

  it("explica o erro do storage sem vazar o corpo cru", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      ok: false,
      status: 413,
      json: async () => ({ error: "payload too large" }),
    } as Response);
    await expect(uploadCatalogOriginal(session, file("livro.pdf"))).rejects.toThrow(
      /50 MB/,
    );
  });

  it("cria o livro com os campos que o backend espera", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ id: "b1" });
    await createCatalogBook(
      session,
      {
        title: "  Dom Casmurro ",
        author: " Machado de Assis ",
        language: "pt",
        rights: "public_domain",
        status: "published",
        featured: true,
        sortOrder: 2,
        pageCount: 256,
        seriesIndex: null,
      },
      { path: "admin-1/a.txt", contentType: "text/plain" },
      { allowDuplicate: true },
    );
    const [url, init] = vi.mocked(apiRequest).mock.calls[0];
    expect(url).toBe("/api/v1/admin/catalog/books");
    expect(init?.method).toBe("POST");
    expect(init?.body).toMatchObject({
      title: "Dom Casmurro",
      author: "Machado de Assis",
      originalPath: "admin-1/a.txt",
      originalContentType: "text/plain",
      rights: "public_domain",
      status: "published",
      featured: true,
      sortOrder: 2,
      pageCount: 256,
      seriesIndex: null,
      allowDuplicate: true,
    });
  });

  it("não manda número de páginas vazio no PATCH (não zera o valor)", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ id: "b1" });
    await updateCatalogBook(session, "b1", {
      title: "Livro",
      language: "pt",
      rights: "own_work",
      featured: false,
      coverUrl: null,
    });
    const body = vi.mocked(apiRequest).mock.calls[0][1]?.body as Record<string, unknown>;
    expect(body).not.toHaveProperty("pageCount");
    expect(body).toMatchObject({ title: "Livro", coverUrl: null, featured: false });
  });

  it("lê o texto para a prévia pelo storage do catálogo", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      text: async () => "Era uma vez",
    } as Response);
    const text = await fetchCatalogText(session, {
      storage_bucket: "catalog-books",
      text_path: "admin-1/b1.txt",
    });
    expect(text).toBe("Era uma vez");
    expect(vi.mocked(apiFetch).mock.calls[0][0]).toContain(
      "/api/v1/storage/catalog-books/object?path=admin-1%2Fb1.txt",
    );
  });

  it("dá rótulo e cor a cada situação", () => {
    expect(catalogStatusLabel("draft")).toBe("Rascunho");
    expect(catalogStatusTone("published")).toBe("is-approved");
    expect(catalogStatusTone("archived")).toBe("is-archived");
  });
});

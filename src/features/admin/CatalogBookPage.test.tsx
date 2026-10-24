import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import {
  deleteCatalogBook,
  getCatalogBook,
  setCatalogBookStatus,
  updateCatalogBook,
  type AdminCatalogBook,
} from "../../lib/adminCatalog";
import { CatalogBookPage } from "./CatalogBookPage";

vi.mock("../../lib/adminCatalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/adminCatalog")>();
  return {
    ...actual,
    getCatalogBook: vi.fn(),
    updateCatalogBook: vi.fn(),
    updateCatalogBookCover: vi.fn(),
    replaceCatalogBookText: vi.fn(),
    setCatalogBookStatus: vi.fn(),
    deleteCatalogBook: vi.fn(),
    uploadCatalogOriginal: vi.fn(),
  };
});

const session = {
  access_token: "token",
  user: { id: "admin-1" },
} as unknown as SupabaseSession;

const book: AdminCatalogBook = {
  id: "b1",
  book_key: "cat:b1",
  source: "admin",
  submission_id: null,
  title: "Dom Casmurro",
  author: "Machado de Assis",
  genre: "Clássico",
  language: "pt",
  series: null,
  series_index: null,
  description: null,
  page_count: 256,
  rights: "public_domain",
  rights_note: null,
  storage_bucket: "catalog-books",
  text_path: "admin-1/b1.txt",
  original_path: "admin-1/b1.txt",
  original_content_type: "text/plain",
  char_count: 1200,
  checksum: "abc",
  cover_url: null,
  status: "draft",
  featured: false,
  sort_order: 0,
  duplicate_of: null,
  published_at: null,
  created_by: "admin-1",
  created_at: "2026-10-24T00:00:00Z",
  updated_at: "2026-10-24T00:00:00Z",
};

function renderPage(roles: string[]) {
  return render(
    <MemoryRouter initialEntries={["/admin/acervo/b1"]}>
      <Routes>
        <Route
          path="/admin/acervo/:id"
          element={<CatalogBookPage session={session} roles={roles} />}
        />
        <Route path="/admin/acervo" element={<div>Lista do acervo</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CatalogBookPage", () => {
  beforeEach(() => {
    vi.mocked(getCatalogBook).mockResolvedValue(book);
    vi.mocked(updateCatalogBook).mockResolvedValue(book);
    vi.mocked(setCatalogBookStatus).mockResolvedValue({ ...book, status: "published" });
    vi.mocked(deleteCatalogBook).mockResolvedValue();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("mostra o livro e esconde apagar do moderador", async () => {
    renderPage(["moderator"]);
    expect(await screen.findByRole("heading", { name: "Dom Casmurro" })).toBeInTheDocument();
    expect(screen.getByText("Rascunho")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apagar" })).toBeNull();
  });

  it("mostra apagar para o superadmin e apaga depois da confirmação", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage(["superadmin"]);
    fireEvent.click(await screen.findByRole("button", { name: "Apagar" }));
    await waitFor(() => expect(deleteCatalogBook).toHaveBeenCalledWith(session, "b1"));
    expect(await screen.findByText("Lista do acervo")).toBeInTheDocument();
  });

  it("publica o livro e atualiza a situação", async () => {
    renderPage(["moderator"]);
    fireEvent.click(await screen.findByRole("button", { name: "Publicar" }));
    await waitFor(() =>
      expect(setCatalogBookStatus).toHaveBeenCalledWith(session, "b1", "publish"),
    );
    expect(await screen.findByText("Publicado", { selector: ".status-chip" })).toBeInTheDocument();
  });

  it("não salva metadados sem título", async () => {
    renderPage(["moderator"]);
    fireEvent.change(await screen.findByLabelText(/Título/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Informe o título/);
    expect(updateCatalogBook).not.toHaveBeenCalled();
  });
});

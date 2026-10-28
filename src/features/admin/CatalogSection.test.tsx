import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import { listCatalogBooks, type AdminCatalogBook } from "../../lib/adminCatalog";
import { CatalogSection } from "./CatalogSection";

vi.mock("../../lib/adminCatalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/adminCatalog")>();
  return { ...actual, listCatalogBooks: vi.fn() };
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
  description: "Um clássico.",
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

function renderSection() {
  return render(
    <MemoryRouter>
      <CatalogSection session={session} />
    </MemoryRouter>,
  );
}

describe("CatalogSection", () => {
  beforeEach(() => {
    vi.mocked(listCatalogBooks).mockResolvedValue({ items: [book], page: 0, limit: 20 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lista o catálogo com situação e origem", async () => {
    renderSection();
    expect(await screen.findByRole("link", { name: "Abrir" })).toHaveAttribute(
      "href",
      "/admin/acervo/b1",
    );
    expect(screen.getAllByText("Dom Casmurro").length).toBeGreaterThan(0);
    expect(screen.getByText("Rascunho", { selector: ".status-chip" })).toBeInTheDocument();
    expect(screen.getByText(/Cadastrado no admin/)).toBeInTheDocument();
  });

  it("busca pelo termo e recarrega com o filtro", async () => {
    renderSection();
    await screen.findByRole("link", { name: "Abrir" });
    fireEvent.change(screen.getByLabelText(/Buscar no catálogo/), {
      target: { value: "machado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() =>
      expect(vi.mocked(listCatalogBooks)).toHaveBeenLastCalledWith(
        session,
        expect.objectContaining({ q: "machado" }),
        0,
      ),
    );
  });

  it("abre o cadastro em etapas", async () => {
    renderSection();
    await screen.findByRole("link", { name: "Abrir" });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar livro" }));
    expect(await screen.findByRole("dialog", { name: "Arquivo" })).toBeInTheDocument();
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  searchCatalog,
  type CatalogBook,
  type CatalogPage,
} from "../../lib/catalog";
import { PublicLibraryPage } from "./PublicLibraryPage";

vi.mock("../../lib/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/catalog")>();
  return { ...actual, searchCatalog: vi.fn() };
});

const featured: CatalogBook = {
  book_key: "cat:11111111-1111-1111-1111-111111111111",
  title: "Dom Casmurro",
  author: "Machado de Assis",
  genre: "Clássico",
  language: "pt",
  series: null,
  series_index: null,
  description: "Um clássico.",
  page_count: 256,
  cover_url: null,
  featured: true,
  published_at: "2026-10-20T00:00:00Z",
};

const latest: CatalogBook = {
  ...featured,
  book_key: "cat:22222222-2222-2222-2222-222222222222",
  title: "Memórias Póstumas",
};

const result: CatalogBook = {
  ...featured,
  book_key: "cat:33333333-3333-3333-3333-333333333333",
  title: "Quincas Borba",
};

function page(items: CatalogBook[]): CatalogPage {
  return { items, page: 0, limit: 12 };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <PublicLibraryPage />
    </MemoryRouter>,
  );
}

describe("PublicLibraryPage", () => {
  beforeEach(() => {
    vi.mocked(searchCatalog).mockImplementation(async (query = {}) => {
      if (query.featured) return page([featured]);
      if (!query.q && (!query.sort || query.sort === "new")) return page([latest]);
      return page([result]);
    });
  });

  it("mostra destaques e novidades e leva para a ficha do livro", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Destaques" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Novidades" })).toBeInTheDocument();
    expect(screen.getAllByText("Dom Casmurro").length).toBeGreaterThan(0);
    const links = screen.getAllByRole("link", { name: /Dom Casmurro|Memórias Póstumas/ });
    expect(links[0]).toHaveAttribute(
      "href",
      "/biblioteca/cat%3A11111111-1111-1111-1111-111111111111",
    );
  });

  it("busca pelo termo e mostra o resultado", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Destaques" });
    fireEvent.change(screen.getByLabelText(/Buscar na biblioteca/), {
      target: { value: "quincas" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(await screen.findByText("Resultados para “quincas”")).toBeInTheDocument();
    await waitFor(() =>
      expect(vi.mocked(searchCatalog)).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: "quincas" }),
      ),
    );
  });

  it("filtra por idioma", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Destaques" });
    fireEvent.change(screen.getByLabelText("Idioma"), { target: { value: "en" } });
    await waitFor(() =>
      expect(vi.mocked(searchCatalog)).toHaveBeenLastCalledWith(
        expect.objectContaining({ language: "en" }),
      ),
    );
  });
});

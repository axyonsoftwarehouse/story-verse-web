import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import {
  createCatalogCollection,
  listCatalogCollections,
  type AdminCatalogCollection,
} from "../../lib/adminCatalog";
import { CollectionsSection } from "./CollectionsSection";

vi.mock("../../lib/adminCatalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/adminCatalog")>();
  return {
    ...actual,
    listCatalogCollections: vi.fn(),
    createCatalogCollection: vi.fn(),
    updateCatalogCollection: vi.fn(),
    deleteCatalogCollection: vi.fn(),
    getCatalogCollection: vi.fn(),
    setCatalogCollectionBooks: vi.fn(),
    listCatalogBooks: vi.fn(),
  };
});

const session = {
  access_token: "token",
  user: { id: "admin-1" },
} as unknown as SupabaseSession;

const collection: AdminCatalogCollection = {
  id: "c1",
  slug: "classicos",
  title: "Clássicos",
  description: "Para começar",
  status: "published",
  sort_order: 0,
  book_count: 3,
  created_at: "2026-10-24T00:00:00Z",
  updated_at: "2026-10-24T00:00:00Z",
};

describe("CollectionsSection", () => {
  beforeEach(() => {
    vi.mocked(listCatalogCollections).mockResolvedValue([collection]);
    vi.mocked(createCatalogCollection).mockResolvedValue({ ...collection, id: "c2" });
  });

  it("lista as coleções com situação e contagem", async () => {
    render(<CollectionsSection session={session} />);
    expect(await screen.findByText("Clássicos")).toBeInTheDocument();
    expect(screen.getByText(/3 livros/)).toBeInTheDocument();
    expect(screen.getByText("Publicada")).toBeInTheDocument();
  });

  it("cria uma coleção e atualiza a lista", async () => {
    render(<CollectionsSection session={session} />);
    await screen.findByText("Clássicos");
    fireEvent.click(screen.getByRole("button", { name: "Nova coleção" }));

    fireEvent.change(screen.getByLabelText(/Título/), {
      target: { value: "Para começar" },
    });
    expect(screen.getByLabelText(/Endereço/)).toHaveValue("para-comecar");
    fireEvent.click(screen.getByRole("button", { name: "Salvar coleção" }));

    await waitFor(() =>
      expect(createCatalogCollection).toHaveBeenCalledWith(
        session,
        expect.objectContaining({ title: "Para começar", slug: "para-comecar" }),
      ),
    );
  });
});

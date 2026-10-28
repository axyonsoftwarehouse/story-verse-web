import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import {
  createCatalogBook,
  uploadCatalogOriginal,
  type AdminCatalogBook,
} from "../../lib/adminCatalog";
import { importBookFile } from "../../lib/importBook";
import { CatalogBookForm } from "./CatalogBookForm";

vi.mock("../../lib/importBook", () => ({
  importBookFile: vi.fn(),
}));

vi.mock("../../lib/adminCatalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/adminCatalog")>();
  return {
    ...actual,
    createCatalogBook: vi.fn(),
    uploadCatalogOriginal: vi.fn(),
  };
});

const session = {
  access_token: "token",
  user: { id: "admin-1" },
} as unknown as SupabaseSession;

const created = {
  id: "b1",
  title: "Dom Casmurro",
} as AdminCatalogBook;

function file(name: string, type = "", bytes = 10): File {
  return new File(["x".repeat(bytes)], name, { type });
}

function renderForm(onCreated = vi.fn()) {
  render(<CatalogBookForm session={session} onClose={vi.fn()} onCreated={onCreated} />);
  return onCreated;
}

function pick(fileToPick: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [fileToPick] } });
}

describe("CatalogBookForm", () => {
  beforeEach(() => {
    vi.mocked(uploadCatalogOriginal).mockResolvedValue({
      path: "admin-1/b1.txt",
      contentType: "text/plain",
    });
    vi.mocked(createCatalogBook).mockResolvedValue(created);
    vi.mocked(importBookFile).mockResolvedValue({
      text: "x".repeat(600),
      title: "Dom Casmurro",
      author: "Machado de Assis",
      language: "pt",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("recusa arquivo fora dos formatos aceitos", () => {
    renderForm();
    pick(file("livro.docx"));
    expect(screen.getByRole("alert")).toHaveTextContent(/Formato de arquivo não aceito/);
  });

  it("preenche t?tulo, autor e idioma lendo o arquivo", async () => {
    renderForm();
    pick(file("livro.epub"));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await waitFor(() => expect(screen.getByLabelText(/T?tulo/)).toHaveValue("Dom Casmurro"));
    expect(screen.getByLabelText(/Autor/)).toHaveValue("Machado de Assis");
  });

  it("percorre as etapas e cria como rascunho", async () => {
    const onCreated = renderForm();
    pick(file("livro.txt"));

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.change(screen.getByLabelText(/Título/), {
      target: { value: "Dom Casmurro" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
    expect(createCatalogBook).toHaveBeenCalledWith(
      session,
      expect.objectContaining({ title: "Dom Casmurro", status: "draft" }),
      { path: "admin-1/b1.txt", contentType: "text/plain" },
      { allowDuplicate: false },
    );
  });

  it("exige justificativa quando a obra não é domínio público", async () => {
    renderForm();
    pick(file("livro.txt"));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.change(screen.getByLabelText(/Título/), { target: { value: "Livro" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    fireEvent.click(screen.getByLabelText(/Obra própria/));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/Explique por que esta obra/);
    expect(createCatalogBook).not.toHaveBeenCalled();
  });

  it("leva de volta à etapa do arquivo quando ele está faltando", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Escolha o arquivo/);
  });
});

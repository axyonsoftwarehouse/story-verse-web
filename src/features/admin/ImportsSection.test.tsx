import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import {
  listCatalogImports,
  runCatalogImport,
  uploadCatalogImportArchive,
} from "../../lib/adminCatalog";
import { ImportsSection } from "./ImportsSection";

vi.mock("../../lib/adminCatalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/adminCatalog")>();
  return {
    ...actual,
    listCatalogImports: vi.fn(),
    uploadCatalogImportArchive: vi.fn(),
    runCatalogImport: vi.fn(),
    getCatalogImport: vi.fn(),
    fetchCatalogImportErrors: vi.fn(),
  };
});

const session = {
  access_token: "token",
  user: { id: "admin-1" },
} as unknown as SupabaseSession;

function zip(): File {
  return new File(["PK"], "lote.zip", { type: "application/zip" });
}

describe("ImportsSection", () => {
  beforeEach(() => {
    vi.mocked(listCatalogImports).mockResolvedValue([]);
    vi.mocked(uploadCatalogImportArchive).mockResolvedValue({
      path: "admin-1/imports/a.zip",
      fileName: "lote.zip",
    });
  });

  it("mostra a prévia antes de importar", async () => {
    vi.mocked(runCatalogImport).mockResolvedValue({
      dryRun: true,
      total: 1,
      items: [
        { line: 2, fileName: "a.txt", status: "ok", message: "Pronto para importar." },
      ],
    });
    const { container } = render(<ImportsSection session={session} />);
    await screen.findByText("Nenhuma importação ainda.");

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [zip()] } });
    fireEvent.click(screen.getByRole("button", { name: "Conferir prévia" }));

    expect(await screen.findByText("Prévia da importação")).toBeInTheDocument();
    expect(screen.getByText("Prontos")).toBeInTheDocument();
    expect(screen.getByText("a.txt")).toBeInTheDocument();
    expect(screen.getByText("Pronto")).toBeInTheDocument();
    await waitFor(() =>
      expect(runCatalogImport).toHaveBeenCalledWith(
        session,
        expect.objectContaining({ dryRun: true, archivePath: "admin-1/imports/a.zip" }),
      ),
    );
  });

  it("importa e mostra o relatório", async () => {
    vi.mocked(runCatalogImport).mockResolvedValue({
      id: "imp-1",
      status: "done",
      file_name: "lote.zip",
      total: 1,
      imported: 1,
      skipped: 0,
      error: null,
      created_at: "2026-10-24T00:00:00Z",
      finished_at: "2026-10-24T00:00:01Z",
      items: [
        {
          line: 2,
          file_name: "a.txt",
          status: "imported",
          message: null,
          bookKey: "cat:11111111-1111-1111-1111-111111111111",
        },
      ],
    });
    const { container } = render(<ImportsSection session={session} />);
    await screen.findByText("Nenhuma importação ainda.");
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [zip()] } });
    fireEvent.click(screen.getByRole("button", { name: "Importar agora" }));

    expect(await screen.findByText("Relatório da importação")).toBeInTheDocument();
    expect(screen.getByText("Importado")).toBeInTheDocument();
    expect(screen.getByText(/Baixar CSV de erros/)).toBeInTheDocument();
  });
});

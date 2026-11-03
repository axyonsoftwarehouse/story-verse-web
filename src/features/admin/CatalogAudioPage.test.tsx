import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import {
  createAudioEdition,
  listAudioEditions,
  updateAudioChapter,
  type AdminAudioChapter,
  type AdminAudioEdition,
} from "../../lib/adminAudiobooks";
import { fetchCatalogText, getCatalogBook, type AdminCatalogBook } from "../../lib/adminCatalog";
import { splitIntoChapters } from "../../lib/chapters";
import { CatalogAudioPage } from "./CatalogAudioPage";

vi.mock("../../lib/adminAudiobooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/adminAudiobooks")>();
  return {
    ...actual,
    listAudioEditions: vi.fn(),
    createAudioEdition: vi.fn(),
    updateAudioEdition: vi.fn(),
    setAudioEditionStatus: vi.fn(),
    deleteAudioEdition: vi.fn(),
    requestAudioUpload: vi.fn(),
    uploadAudioFile: vi.fn(),
    registerAudioChapter: vi.fn(),
    updateAudioChapter: vi.fn(),
  };
});

vi.mock("../../lib/adminCatalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/adminCatalog")>();
  return { ...actual, getCatalogBook: vi.fn(), fetchCatalogText: vi.fn() };
});

vi.mock("../../lib/chapters", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/chapters")>();
  return { ...actual, splitIntoChapters: vi.fn() };
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

function chapter(index: number, overrides: Partial<AdminAudioChapter> = {}): AdminAudioChapter {
  return {
    id: `c${index}`,
    audio_id: "a1",
    chapter_index: index,
    title: `Capítulo ${index}`,
    audio_path: `books/b1/a1/${index}.mp3`,
    duration_seconds: 60,
    start_seconds: 0,
    end_seconds: 60,
    size_bytes: 100,
    status: "ready",
    text_chapter_index: null,
    text_chapter_end_index: null,
    ...overrides,
  };
}

function edition(overrides: Partial<AdminAudioEdition> = {}): AdminAudioEdition {
  return {
    id: "a1",
    book_id: "b1",
    language: "pt",
    narrator: "Karen Savage",
    source: "librivox",
    source_url: "https://librivox.org/livro",
    rights: "public_domain",
    rights_note: null,
    license_note: "LibriVox · domínio público",
    text_mapping: "mapped",
    total_duration_seconds: 120,
    chapter_count: 2,
    cover_url: null,
    status: "draft",
    published_at: null,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    chapters: [chapter(1), chapter(2)],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/acervo/b1/audio"]}>
      <Routes>
        <Route
          path="/admin/acervo/:id/audio"
          element={<CatalogAudioPage session={session} roles={["moderator"]} />}
        />
        <Route path="/admin/acervo/:id" element={<div>Página do livro</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CatalogAudioPage", () => {
  beforeEach(() => {
    vi.mocked(getCatalogBook).mockResolvedValue(book);
    vi.mocked(fetchCatalogText).mockResolvedValue("texto do livro");
    vi.mocked(splitIntoChapters).mockReturnValue([
      { index: 0, label: "Capítulo I", body: "Começo" },
      { index: 1, label: "Capítulo II", body: "Meio" },
    ]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("mostra o livro e permite criar a primeira edição", async () => {
    const created = edition({ chapters: [] });
    vi.mocked(listAudioEditions)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([created]);
    vi.mocked(createAudioEdition).mockResolvedValue(created);

    renderPage();

    expect(await screen.findByRole("heading", { name: "Audiolivro" })).toBeInTheDocument();
    expect(await screen.findByText("Nenhuma edição de áudio ainda.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Narrador"), {
      target: { value: "Karen Savage" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar edição" }));

    await waitFor(() =>
      expect(createAudioEdition).toHaveBeenCalledWith(
        session,
        "b1",
        expect.objectContaining({ narrator: "Karen Savage", source: "librivox" }),
      ),
    );
    expect(await screen.findByText("Edição de áudio criada.")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Capítulos" })).toBeInTheDocument();
  });

  it("mapeia um capítulo de áudio para o capítulo do texto", async () => {
    vi.mocked(listAudioEditions).mockResolvedValue([edition()]);
    vi.mocked(updateAudioChapter).mockResolvedValue(
      chapter(1, { text_chapter_index: 2, text_chapter_end_index: 2 }),
    );

    renderPage();

    const select = await screen.findByLabelText("Capítulo do texto do áudio 1");
    await waitFor(() =>
      expect(within(select).getByRole("option", { name: "2. Capítulo II" })).toBeInTheDocument(),
    );
    fireEvent.change(select, { target: { value: "2" } });

    await waitFor(() =>
      expect(updateAudioChapter).toHaveBeenCalledWith(session, "a1", 1, {
        textChapterIndex: 2,
      }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Capítulo do texto do áudio 1")).toHaveValue("2"),
    );
  });

  it("mapeia pela ordem os capítulos disponíveis", async () => {
    vi.mocked(listAudioEditions).mockResolvedValue([edition()]);
    vi.mocked(updateAudioChapter).mockImplementation(async (_session, _audioId, index) =>
      chapter(index, { text_chapter_index: index, text_chapter_end_index: index }),
    );

    renderPage();

    const mapButton = await screen.findByRole("button", { name: "Mapear pela ordem" });
    await waitFor(() => expect(mapButton).not.toBeDisabled());
    fireEvent.click(mapButton);

    await waitFor(() =>
      expect(updateAudioChapter).toHaveBeenCalledWith(session, "a1", 1, {
        textChapterIndex: 1,
        textChapterEndIndex: 1,
      }),
    );
    expect(updateAudioChapter).toHaveBeenCalledWith(session, "a1", 2, {
      textChapterIndex: 2,
      textChapterEndIndex: 2,
    });
    expect(await screen.findByText("2 capítulo(s) mapeados pela ordem.")).toBeInTheDocument();
  });

  it("avisa quando o texto e o áudio têm contagens diferentes", async () => {
    vi.mocked(listAudioEditions).mockResolvedValue([
      edition({ chapters: [chapter(1), chapter(2), chapter(3)] }),
    ]);

    renderPage();

    expect(
      await screen.findByText(/O áudio tem 3 capítulo\(s\) e o texto tem 2/),
    ).toBeInTheDocument();
  });

  it("bloqueia a publicação enquanto o mapeamento do texto está pendente", async () => {
    vi.mocked(listAudioEditions).mockResolvedValue([edition({ text_mapping: "pending" })]);

    renderPage();

    const publish = await screen.findByRole("button", { name: "Publicar audiolivro" });
    expect(publish).toBeDisabled();
    expect(
      await screen.findByText("Defina o mapeamento do texto na edição antes de publicar."),
    ).toBeInTheDocument();
  });

  it("permite editar título e tempos de um capítulo do arquivo único", async () => {
    vi.mocked(listAudioEditions).mockResolvedValue([
      edition({
        chapters: [
          chapter(1, { start_seconds: 0, end_seconds: 60 }),
          chapter(2, { start_seconds: 60, end_seconds: 180 }),
        ],
      }),
    ]);
    vi.mocked(updateAudioChapter).mockResolvedValue(
      chapter(1, { title: "Abertura", start_seconds: 0, end_seconds: 30 }),
    );

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Editar tempos do capítulo 1" }));
    fireEvent.change(screen.getByLabelText("Título do capítulo 1"), {
      target: { value: "Abertura" },
    });
    fireEvent.change(screen.getByLabelText("Fim do capítulo 1"), {
      target: { value: "0:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(updateAudioChapter).toHaveBeenCalledWith(session, "a1", 1, {
        title: "Abertura",
        startSeconds: 0,
        endSeconds: 30,
      }),
    );
  });
});

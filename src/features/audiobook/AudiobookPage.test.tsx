import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAudioManifest, fetchAudioStream, type AudioManifest } from "../../lib/publicAudiobooks";
import { AudiobookPage } from "./AudiobookPage";

vi.mock("../auth/useStoredSession", () => ({
  useStoredSession: () => ({ session: null, loading: false }),
}));

vi.mock("../../lib/publicAudiobooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/publicAudiobooks")>();
  return { ...actual, fetchAudioManifest: vi.fn(), fetchAudioStream: vi.fn() };
});

function manifest(chapters: Array<{ index: number; free: boolean; durationSeconds: number }>): AudioManifest {
  return {
    book: { bookKey: "cat:1", title: "Livro", author: "Autora", coverUrl: null },
    editions: [
      {
        id: "ed-1",
        language: "pt",
        narrator: null,
        source: "librivox",
        sourceUrl: null,
        rights: "public_domain",
        licenseNote: null,
        totalDurationSeconds: chapters.reduce((sum, item) => sum + item.durationSeconds, 0),
        chapterCount: chapters.length,
        coverUrl: null,
        freeChapterIndex: chapters.some((item) => item.free) ? 1 : null,
        requiresSubscription: true,
        chapters: chapters.map((item) => ({
          ...item,
          title: null,
          startSeconds: 0,
          endSeconds: null,
          textChapterIndex: null,
          textChapterEndIndex: null,
        })),
      },
    ],
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/ouvir/cat%3A1"]}>
      <Routes>
        <Route path="/ouvir/:bookKey" element={<AudiobookPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AudiobookPage sem conta (S4)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(fetchAudioStream).mockReset();
  });

  it("audiolivro sem amostra aberta mostra o convite para entrar, não um erro", async () => {
    vi.mocked(fetchAudioManifest).mockResolvedValue(manifest([{ index: 1, free: false, durationSeconds: 25_916 }]));

    renderPage();

    expect(await screen.findByText("Este audiolivro é para assinantes. Entre na sua conta para ouvir.")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Entrar para ouvir" });
    const href = link.getAttribute("href") ?? "";
    expect(new URLSearchParams(href.split("?")[1]).get("retorno")).toBe("/ouvir/cat%3A1");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(fetchAudioStream).not.toHaveBeenCalled();
  });

  it("com amostra aberta, carrega o capítulo 1 sem pedir conta", async () => {
    vi.mocked(fetchAudioManifest).mockResolvedValue(
      manifest([
        { index: 1, free: true, durationSeconds: 600 },
        { index: 2, free: false, durationSeconds: 900 },
      ]),
    );
    vi.mocked(fetchAudioStream).mockResolvedValue({
      url: "https://audio.example/1.mp3",
      startSeconds: 0,
      endSeconds: null,
      durationSeconds: 600,
      mimeType: "audio/mpeg",
      expiresInSeconds: 3600,
    });

    renderPage();

    expect(await screen.findByText("O primeiro capítulo é aberto. Entre na sua conta para ouvir os demais.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Entrar para ouvir" })).toBeNull();
    expect(fetchAudioStream).toHaveBeenCalledWith("cat:1", "ed-1", 1, undefined);
  });
});

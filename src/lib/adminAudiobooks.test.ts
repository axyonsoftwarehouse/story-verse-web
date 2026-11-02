import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "./auth";
import { apiRequest } from "./backend";
import {
  MAX_AUDIO_BYTES,
  audioFileKind,
  chapterTitleFromFile,
  checkAudioFile,
  createAudioEdition,
  formatAudioClock,
  formatAudioDuration,
  listAudioEditions,
  parseAudioClock,
  registerAudioChapter,
  requestAudioUpload,
  uploadAudioFile,
} from "./adminAudiobooks";

vi.mock("./backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./backend")>();
  return { ...actual, apiRequest: vi.fn() };
});

const session = {
  access_token: "token",
  user: { id: "admin-1" },
} as unknown as SupabaseSession;

function file(name: string, type = ""): File {
  return new File(["x"], name, { type });
}

describe("adminAudiobooks", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reconhece os formatos de áudio e recusa o resto", () => {
    expect(audioFileKind(file("capitulo.mp3"))).toEqual({
      contentType: "audio/mpeg",
      extension: ".mp3",
    });
    expect(audioFileKind(file("livro.m4b", "audio/mp4"))).toEqual({
      contentType: "audio/mp4",
      extension: ".m4b",
    });
    expect(audioFileKind(file("sem-extensao", "audio/ogg"))).toEqual({
      contentType: "audio/ogg",
      extension: ".ogg",
    });
    expect(() => audioFileKind(file("capa.png", "image/png"))).toThrow(/Formato de áudio/);
  });

  it("valida tamanho e arquivo vazio", () => {
    const empty = new File([], "vazio.mp3", { type: "audio/mpeg" });
    expect(() => checkAudioFile(empty)).toThrow(/vazio/);

    const huge = file("grande.mp3");
    Object.defineProperty(huge, "size", { value: MAX_AUDIO_BYTES + 1 });
    expect(() => checkAudioFile(huge)).toThrow(/1 GB/);
  });

  it("formata e lê relógios de áudio", () => {
    expect(formatAudioClock(0)).toBe("0:00");
    expect(formatAudioClock(65)).toBe("1:05");
    expect(formatAudioClock(3725)).toBe("1:02:05");
    expect(formatAudioDuration(0)).toBe("0 s");
    expect(formatAudioDuration(125)).toBe("2 min");
    expect(formatAudioDuration(3725)).toBe("1 h 2 min");
    expect(parseAudioClock("12:34")).toBe(754);
    expect(parseAudioClock("1:02:05")).toBe(3725);
    expect(parseAudioClock("90")).toBe(90);
    expect(parseAudioClock("12:99")).toBeNull();
    expect(parseAudioClock("abc")).toBeNull();
  });

  it("transforma nome de arquivo em título de capítulo", () => {
    expect(chapterTitleFromFile("capitulo_01.mp3")).toBe("capitulo 01");
    expect(chapterTitleFromFile(".mp3")).toBe("Capítulo");
  });

  it("lista edições normalizando a resposta", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      editions: [
        {
          id: "a1",
          book_id: "b1",
          language: "pt",
          narrator: "Narrador",
          source: "librivox",
          source_url: null,
          rights: "public_domain",
          rights_note: null,
          license_note: null,
          total_duration_seconds: 100,
          chapter_count: 1,
          cover_url: null,
          status: "draft",
          published_at: null,
          created_at: "2026-11-01T00:00:00Z",
          updated_at: "2026-11-01T00:00:00Z",
        },
      ],
    });
    const editions = await listAudioEditions(session, "b1");
    expect(editions[0].chapters).toEqual([]);
    expect(vi.mocked(apiRequest).mock.calls[0][0]).toBe(
      "/api/v1/admin/catalog/books/b1/audio",
    );
  });

  it("cria a edição com os campos que o backend espera", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      id: "a1",
      book_id: "b1",
      language: "pt",
      narrator: null,
      source: "librivox",
      source_url: null,
      rights: "public_domain",
      rights_note: null,
      license_note: null,
      total_duration_seconds: 0,
      chapter_count: 0,
      cover_url: null,
      status: "draft",
      published_at: null,
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-01T00:00:00Z",
      chapters: [],
    });
    await createAudioEdition(session, "b1", {
      language: "pt",
      narrator: "  Karen Savage ",
      source: "librivox",
      sourceUrl: " https://librivox.org/ ",
      rights: "public_domain",
      rightsNote: " LibriVox ",
      licenseNote: " Domínio público ",
    });
    const [url, init] = vi.mocked(apiRequest).mock.calls[0];
    expect(url).toBe("/api/v1/admin/catalog/books/b1/audio");
    expect(init?.method).toBe("POST");
    expect(init?.body).toMatchObject({
      language: "pt",
      narrator: "Karen Savage",
      source: "librivox",
      sourceUrl: "https://librivox.org/",
      rights: "public_domain",
      rightsNote: "LibriVox",
      licenseNote: "Domínio público",
    });
  });

  it("pede a URL assinada e registra o capítulo", async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ uploadUrl: "https://r2.test/put", path: "books/b1/a1/1.mp3" })
      .mockResolvedValueOnce({ id: "c1", chapter_index: 1 });

    const target = await requestAudioUpload(
      session,
      "a1",
      "capitulo.mp3",
      "audio/mpeg",
      1024,
    );
    expect(target.path).toBe("books/b1/a1/1.mp3");
    expect(vi.mocked(apiRequest).mock.calls[0][0]).toBe(
      "/api/v1/admin/catalog/audio/a1/upload-url",
    );
    expect(vi.mocked(apiRequest).mock.calls[0][1]?.body).toEqual({
      fileName: "capitulo.mp3",
      contentType: "audio/mpeg",
      sizeBytes: 1024,
    });

    await registerAudioChapter(session, "a1", {
      path: target.path,
      chapterIndex: 1,
      title: "Capítulo 1",
      durationSeconds: 60,
    });
    expect(vi.mocked(apiRequest).mock.calls[1][0]).toBe(
      "/api/v1/admin/catalog/audio/a1/chapters",
    );
    expect(vi.mocked(apiRequest).mock.calls[1][1]?.body).toMatchObject({
      path: "books/b1/a1/1.mp3",
      chapterIndex: 1,
      title: "Capítulo 1",
      durationSeconds: 60,
      startSeconds: 0,
      endSeconds: null,
    });
  });

  it("envia o arquivo para a URL assinada", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const audio = file("capitulo.mp3", "audio/mpeg");
    await uploadAudioFile("https://r2.test/put", audio, "audio/mpeg");
    expect(fetchMock).toHaveBeenCalledWith("https://r2.test/put", {
      method: "PUT",
      headers: { "Content-Type": "audio/mpeg" },
      body: audio,
    });

    fetchMock.mockResolvedValueOnce({ ok: false, status: 413 });
    await expect(uploadAudioFile("https://r2.test/put", audio, "audio/mpeg")).rejects.toThrow(
      /413/,
    );
  });
});

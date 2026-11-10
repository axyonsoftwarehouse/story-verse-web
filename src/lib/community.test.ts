import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "./auth";
import { apiFetch, apiRequest } from "./backend";
import {
  communityIdOf,
  deleteSubmission,
  fetchCommunityBookText,
  submissionToEbook,
  type Submission,
} from "./community";

vi.mock("./backend", () => ({
  ApiHttpError: class ApiHttpError extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message);
    }
  },
  apiBaseUrl: "https://api.example.test",
  apiEnabled: true,
  apiFetch: vi.fn(),
  apiRequest: vi.fn(),
}));

const session = { access_token: "token", user: { id: "u1" } } as unknown as SupabaseSession;

const submission: Submission = {
  id: "s1",
  user_id: "u1",
  submitter_name: "Leitor",
  title: "Livro",
  author: "Autor",
  language: "pt",
  rights: "public_domain",
  rights_note: null,
  characters: null,
  text_path: "u1/s1.txt",
  char_count: 100,
  status: "approved",
  review_note: null,
  reviewed_at: null,
  created_at: "2026-01-01T00:00:00Z",
  cover_url:
    "https://api.example.test/api/v1/storage/public/profile-media/u1/livros/c.png",
};

describe("acervo", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("apaga o envio na API sem tocar no storage", async () => {
    vi.mocked(apiRequest).mockResolvedValue(undefined as never);

    await deleteSubmission(session, submission);

    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(apiRequest).toHaveBeenCalledWith(
      `/api/v1/community/submissions/${submission.id}`,
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

describe("texto da comunidade por id (S9)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const text = (body: string, status = 200) =>
    new Response(body, { status, headers: { "Content-Type": status === 200 ? "text/plain" : "application/json" } });

  it("livro da estante pública (sem text_path) vira Ebook com o id do envio", () => {
    const publico: Submission = { ...submission };
    delete publico.user_id;
    delete publico.text_path;
    const book = submissionToEbook(publico);
    expect(book.communityId).toBe("s1");
    expect(book.communityPath).toBeUndefined();
  });

  it("acha o id em livros salvos antes do campo novo", () => {
    expect(communityIdOf({ id: "cm-abc" })).toBe("abc");
    expect(communityIdOf({ id: "cm-abc", communityId: "xyz" })).toBe("xyz");
    expect(communityIdOf({ id: "gb-1" })).toBeNull();
  });

  it("pede o texto por id", async () => {
    vi.mocked(apiFetch).mockResolvedValue(text("Era uma vez"));

    const result = await fetchCommunityBookText(session, { id: "cm-s1", communityId: "s1" });

    expect(result).toBe("Era uma vez");
    expect(vi.mocked(apiFetch).mock.calls[0][0]).toBe("/api/v1/community/submissions/s1/text");
  });

  it("API antiga sem a rota (404): usa o caminho guardado", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(text("{}", 404))
      .mockResolvedValueOnce(text("pelo caminho"));

    const result = await fetchCommunityBookText(session, { id: "cm-s1", communityPath: "u1/s1.txt" });

    expect(result).toBe("pelo caminho");
    expect(vi.mocked(apiFetch).mock.calls[1][0]).toContain("/api/v1/storage/community-books/object?path=u1%2Fs1.txt");
  });

  it("402 não cai no caminho: mostra o erro da assinatura", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Assinatura necessária." }), { status: 402 }),
    );

    await expect(fetchCommunityBookText(session, { id: "cm-s1", communityPath: "u1/s1.txt" })).rejects.toMatchObject({
      status: 402,
      message: "Assinatura necessária.",
    });
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "./auth";
import { apiFetch, apiRequest } from "./backend";
import { deleteSubmission, type Submission } from "./community";

vi.mock("./backend", () => ({
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

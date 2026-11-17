import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import { listSubmissions, reviewSubmission, updateSubmissionDetails, type Submission } from "../../lib/community";
import { SubmissionsModeration } from "./SubmissionsModeration";

vi.mock("../../lib/community", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/community")>();
  return { ...actual, listSubmissions: vi.fn(), reviewSubmission: vi.fn(), updateSubmissionDetails: vi.fn() };
});
// Sem rede: a conferência de direitos na Open Library e a busca de capa não respondem nada.
vi.mock("../../lib/bookCovers", () => ({
  lookupPublication: vi.fn(() => Promise.resolve(null)),
  findOpenLibraryCover: vi.fn(() => Promise.resolve(undefined)),
}));

const session = { access_token: "token", user: { id: "admin-1" } } as unknown as SupabaseSession;

const raw: Submission = {
  id: "s1",
  user_id: "u1",
  submitter_name: "Leitora",
  title: "Morte_DiaValePenaViver_FINAL.indd",
  author: null,
  language: "pt",
  rights: "own_work",
  rights_note: null,
  characters: null,
  text_path: "u1/s1.txt",
  char_count: 1800,
  status: "pending",
  review_note: null,
  reviewed_at: null,
  created_at: "2026-11-10T12:00:00Z",
  cover_url: null,
};

describe("SubmissionsModeration · dados do livro (U1)", () => {
  beforeEach(() => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    vi.mocked(listSubmissions).mockImplementation((_s, scope) => Promise.resolve(scope === "pending" ? [raw] : []));
  });
  afterEach(() => vi.clearAllMocks());

  it("não aprova título de arquivo e libera depois de corrigir em Editar dados", async () => {
    vi.mocked(updateSubmissionDetails).mockResolvedValue({ ...raw, title: "Morte", author: "Ana Arantes" });
    render(<SubmissionsModeration session={session} />);

    const approve = await screen.findByRole("button", { name: "Aprovar" });
    expect(approve).toBeDisabled();
    expect(screen.getByText(/parece nome de arquivo/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Editar dados" }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Morte" } });
    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Ana Arantes" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar dados" }));

    await waitFor(() =>
      expect(updateSubmissionDetails).toHaveBeenCalledWith(session, "s1", { title: "Morte", author: "Ana Arantes" }),
    );
    await waitFor(() => expect(screen.queryByText(/parece nome de arquivo/)).not.toBeInTheDocument());
    // V1: ainda falta a justificativa de quem aprova.
    expect(screen.getByRole("button", { name: "Aprovar" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Por que pode ser publicado/), {
      target: { value: "Obra própria, conferida com a autora" },
    });
    expect(screen.getByRole("button", { name: "Aprovar" })).toBeEnabled();
    expect(reviewSubmission).not.toHaveBeenCalled();
  });

  it("aprova enviando a justificativa de direitos e lembra a regra do domínio público", async () => {
    const ok = { ...raw, title: "Dom Casmurro", author: "Machado de Assis", rights: "public_domain" as const };
    vi.mocked(listSubmissions).mockImplementation((_s, scope) => Promise.resolve(scope === "pending" ? [ok] : []));
    vi.mocked(reviewSubmission).mockResolvedValue({ ...ok, status: "approved" });
    render(<SubmissionsModeration session={session} />);

    expect(await screen.findByRole("note")).toHaveTextContent(/70 anos depois da morte do autor/);
    fireEvent.change(screen.getByLabelText(/Por que pode ser publicado/), { target: { value: "curto" } });
    expect(screen.getByRole("button", { name: "Aprovar" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Por que pode ser publicado/), {
      target: { value: "Domínio Público (MEC); Machado morreu em 1908" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));

    await waitFor(() =>
      expect(reviewSubmission).toHaveBeenCalledWith(
        session,
        "s1",
        "approved",
        undefined,
        null,
        "Domínio Público (MEC); Machado morreu em 1908",
      ),
    );
  });

  it("não deixa salvar autor que não identifica ninguém", async () => {
    render(<SubmissionsModeration session={session} />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar dados" }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Mulheres que correm com os lobos" } });
    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "V" } });
    expect(screen.getByRole("button", { name: "Salvar dados" })).toBeDisabled();
    expect(screen.getByText("Informe o autor do livro.")).toBeInTheDocument();
  });
});

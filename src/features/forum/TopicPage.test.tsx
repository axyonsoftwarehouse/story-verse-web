import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import type { ForumReply, ForumTopic } from "../../lib/forum";
import { TopicPage } from "./TopicPage";

const mocks = vi.hoisted(() => ({
  session: null as SupabaseSession | null,
  roles: [] as string[],
  getTopic: vi.fn(),
  listReplies: vi.fn(),
  createReply: vi.fn(),
  reportContent: vi.fn(),
}));

vi.mock("../auth/useStoredSession", () => ({
  useStoredSession: () => ({ session: mocks.session, loading: false }),
}));

vi.mock("../../lib/backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/backend")>();
  return { ...actual, apiRequest: vi.fn(async () => ({ roles: mocks.roles })) };
});

vi.mock("../../lib/forum", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/forum")>();
  return {
    ...actual,
    getTopic: mocks.getTopic,
    listReplies: mocks.listReplies,
    createReply: mocks.createReply,
    reportContent: mocks.reportContent,
  };
});

const session: SupabaseSession = {
  access_token: "token-123",
  refresh_token: "",
  expires_at: 9999999999,
  user: { id: "topic-author", email: "autor@example.test" },
};

const topic: ForumTopic = {
  id: "t1",
  space_id: "s1",
  space_slug: "geral",
  space_name: "Geral",
  author_id: "topic-author",
  author_name: "Autora",
  author_avatar: "",
  title: "Qual o melhor capítulo?",
  body: "Quero opiniões.",
  book_key: null,
  chapter_ref: null,
  spoiler_level: "none",
  status: "published",
  is_pinned: false,
  is_locked: false,
  accepted_reply_id: null,
  reply_count: 3,
  reaction_count: 0,
  last_activity_at: "2026-10-25T12:00:00Z",
  created_at: "2026-10-25T12:00:00Z",
  updated_at: "2026-10-25T12:00:00Z",
  bookmarked: false,
  liked: false,
};

function reply(id: string, authorId: string): ForumReply {
  return {
    id,
    topic_id: "t1",
    author_id: authorId,
    author_name: `Leitor ${id}`,
    author_avatar: "",
    parent_id: null,
    body: `Texto ${id}`,
    status: "published",
    spoiler_level: "none",
    reaction_count: 0,
    liked: false,
    created_at: "2026-10-25T12:00:00Z",
    updated_at: "2026-10-25T12:00:00Z",
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/comunidade/t/t1"]}>
      <Routes>
        <Route path="/comunidade/t/:id" element={<TopicPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function replyCard(text: string): HTMLElement {
  return screen.getByText(text).closest("article") as HTMLElement;
}

beforeEach(() => {
  mocks.session = session;
  mocks.roles = [];
  mocks.getTopic.mockReset().mockResolvedValue(topic);
  mocks.listReplies.mockReset();
  mocks.createReply.mockReset();
  mocks.reportContent.mockReset().mockResolvedValue({});
});

describe("TopicPage", () => {
  it("só oferece remover a resposta para quem a API deixa remover", async () => {
    mocks.listReplies.mockResolvedValue({
      items: [reply("r1", "outra-pessoa"), reply("r2", "topic-author")],
      nextCursor: null,
    });
    renderPage();
    await screen.findByText("Texto r1");
    // Autora do tópico, sem ser equipe: a API devolve 403 ao remover resposta de outra pessoa.
    expect(within(replyCard("Texto r1")).queryByRole("button", { name: "Remover" })).toBeNull();
    expect(within(replyCard("Texto r2")).getByRole("button", { name: "Remover" })).toBeTruthy();
  });

  it("a equipe pode remover qualquer resposta", async () => {
    mocks.session = { ...session, user: { id: "mod", email: "mod@example.test" } };
    mocks.roles = ["moderator"];
    mocks.listReplies.mockResolvedValue({ items: [reply("r1", "outra-pessoa")], nextCursor: null });
    renderPage();
    await screen.findByText("Texto r1");
    await waitFor(() =>
      expect(within(replyCard("Texto r1")).getByRole("button", { name: "Remover" })).toBeTruthy(),
    );
  });

  it("carregar mais não repete resposta e o título mostra o total", async () => {
    mocks.listReplies
      .mockResolvedValueOnce({ items: [reply("r1", "a")], nextCursor: "c1" })
      .mockResolvedValueOnce({ items: [reply("r1", "a"), reply("r2", "b")], nextCursor: null });
    renderPage();
    await screen.findByText("Texto r1");
    expect(screen.getByRole("heading", { name: "3 respostas" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    await screen.findByText("Texto r2");
    expect(screen.getAllByText("Texto r1")).toHaveLength(1);
    expect(mocks.listReplies).toHaveBeenLastCalledWith(session, "t1", "c1");
  });

  it("denuncia uma resposta", async () => {
    mocks.listReplies.mockResolvedValue({ items: [reply("r1", "outra-pessoa")], nextCursor: null });
    renderPage();
    await screen.findByText("Texto r1");
    fireEvent.click(within(replyCard("Texto r1")).getByRole("button", { name: "Denunciar" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar denúncia" }));
    await screen.findByText("Denúncia enviada para a moderação.");
    expect(mocks.reportContent).toHaveBeenCalledWith(session, {
      targetType: "reply",
      targetId: "r1",
      reasonCode: "spam",
      details: "",
    });
  });

  it("resposta publicada entra na lista quando todas as páginas já estão na tela", async () => {
    mocks.listReplies.mockResolvedValue({ items: [reply("r1", "a")], nextCursor: null });
    mocks.createReply.mockResolvedValue(reply("r9", "topic-author"));
    renderPage();
    await screen.findByText("Texto r1");
    fireEvent.change(screen.getByLabelText("Sua resposta"), { target: { value: "Minha resposta" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar resposta" }));
    await screen.findByText("Texto r9");
    expect(screen.getByRole("heading", { name: "4 respostas" })).toBeTruthy();
    expect(mocks.listReplies).toHaveBeenCalledTimes(1);
  });
});

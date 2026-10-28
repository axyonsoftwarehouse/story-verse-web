import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseSession } from "../../lib/auth";
import { ApiHttpError } from "../../lib/backend";
import type { ForumSpace, ForumTopic } from "../../lib/forum";
import { ForumHome } from "./ForumHome";

const mocks = vi.hoisted(() => ({
  session: null as SupabaseSession | null,
  listSpaces: vi.fn(),
  listTopics: vi.fn(),
}));

vi.mock("../auth/useStoredSession", () => ({
  useStoredSession: () => ({ session: mocks.session, loading: false }),
}));

vi.mock("../../lib/forum", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/forum")>();
  return {
    ...actual,
    listSpaces: mocks.listSpaces,
    listTopics: mocks.listTopics,
  };
});

const session: SupabaseSession = {
  access_token: "token-123",
  refresh_token: "",
  expires_at: 9999999999,
  user: { id: "user-1", email: "leitor@example.test" },
};

const spaces: ForumSpace[] = [{ id: "s1", slug: "geral", name: "Geral", description: null, topic_count: 0, last_activity_at: null }];

function makeTopic(overrides: Partial<ForumTopic> = {}): ForumTopic {
  return {
    id: "t1",
    space_id: "s1",
    space_slug: "geral",
    space_name: "Geral",
    author_id: "u1",
    author_name: "Autor",
    author_avatar: "",
    title: "Tópico 1",
    excerpt: "Resumo",
    book_key: null,
    chapter_ref: null,
    spoiler_level: "none",
    status: "published",
    is_pinned: false,
    is_locked: false,
    accepted_reply_id: null,
    reply_count: 0,
    reaction_count: 0,
    last_activity_at: "2026-10-25T12:00:00Z",
    created_at: "2026-10-25T12:00:00Z",
    updated_at: "2026-10-25T12:00:00Z",
    bookmarked: false,
    liked: false,
    ...overrides,
  };
}

function renderHome() {
  return render(
    <MemoryRouter>
      <ForumHome />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.session = session;
  mocks.listSpaces.mockResolvedValue(spaces);
  mocks.listTopics.mockResolvedValue({ items: [], nextCursor: null });
});

describe("ForumHome", () => {
  it("402 (paywall) mostra o erro da API, o link \"Ver o plano\" e esconde o estado vazio", async () => {
    mocks.listTopics.mockRejectedValue(new ApiHttpError("Assinatura necessária.", 402, undefined, {}));
    renderHome();

    expect(await screen.findByText("Assinatura necessária.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver o plano" })).toHaveAttribute("href", "/assinar");
    expect(screen.queryByText("Nenhum tópico por aqui ainda. Abra o primeiro!")).not.toBeInTheDocument();
  });

  it("401 (anônimo) mostra \"Não autenticado.\" sem \"Ver o plano\" nem estado vazio", async () => {
    mocks.listTopics.mockRejectedValue(new Error("Não autenticado."));
    renderHome();

    expect(await screen.findByText("Não autenticado.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ver o plano" })).not.toBeInTheDocument();
    expect(screen.queryByText("Nenhum tópico por aqui ainda. Abra o primeiro!")).not.toBeInTheDocument();
  });

  it("lista normal renderiza os títulos e não mostra aviso de erro", async () => {
    mocks.listTopics.mockResolvedValue({
      items: [
        makeTopic({ id: "t1", title: "Primeiro tópico" }),
        makeTopic({ id: "t2", title: "Segundo tópico" }),
      ],
      nextCursor: null,
    });
    renderHome();

    expect(await screen.findByText("Primeiro tópico")).toBeInTheDocument();
    expect(screen.getByText("Segundo tópico")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("lista vazia sem erro mostra o estado vazio", async () => {
    mocks.listTopics.mockResolvedValue({ items: [], nextCursor: null });
    renderHome();

    expect(await screen.findByText("Nenhum tópico por aqui ainda. Abra o primeiro!")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

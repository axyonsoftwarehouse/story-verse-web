import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Group, GroupMember, GroupMessage } from "../../lib/groups";
import type { Cosmetics } from "../../lib/shop";

const getGroup = vi.fn();
const listMessages = vi.fn();

vi.mock("../auth/useStoredSession", () => ({
  useStoredSession: () => ({ session: { user: { id: "eu" } }, loading: false }),
}));

vi.mock("./groupHelpers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./groupHelpers")>()),
  useGroupsGate: () => ({ ready: true, blocked: null }),
}));

vi.mock("../../lib/groups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/groups")>()),
  getGroup: (id: string) => getGroup(id),
  listMessages: (id: string, opts: unknown) => listMessages(id, opts),
  openGroupStream: () => () => {},
  markRead: vi.fn(async () => {}),
  noteDelivered: vi.fn(),
  sendTyping: vi.fn(async () => {}),
}));

import { GroupChat } from "./GroupChat";

const cosmetics: Cosmetics = {
  frame: { image: "/shop/f-ouro.png", animated: null, tier: "rare" },
  badge: { image: "/shop/b-coruja.webp", name: "Coruja" },
  name_color: ["#ff8800"],
};

const member = (over: Partial<GroupMember>): GroupMember => ({
  user_id: "ana",
  role: "member",
  joined_at: "2026-11-01T00:00:00Z",
  name: "Ana",
  avatar: "",
  photo: null,
  progress_percent: null,
  book_status: null,
  cosmetics,
  ...over,
});

const group = (over: Partial<Group>): Group => ({
  id: "g1",
  name: "Clube",
  description: null,
  photo_url: null,
  background: null,
  visibility: "private",
  owner_id: "eu",
  book_key: null,
  book_title: null,
  book_cover: null,
  goal_chapter: null,
  goal_until: null,
  last_message_at: null,
  created_at: "2026-11-01T00:00:00Z",
  member_count: 2,
  is_member: true,
  my_role: "owner",
  muted: false,
  last_read_id: 0,
  unread: 0,
  invite_code: null,
  last_message_id: null,
  last_author_name: null,
  last_body: null,
  members: [member({ user_id: "eu", name: "Eu", cosmetics: null }), member({})],
  ...over,
});

const msg = (over: Partial<GroupMessage>): GroupMessage => ({
  id: 1,
  group_id: "g1",
  author_id: "ana",
  author_name: "Ana",
  author_avatar: "",
  author_photo: null,
  author_cosmetics: cosmetics,
  body: "Oi, gente!",
  spoiler_chapter: null,
  reply_to: null,
  created_at: "2026-11-12T10:00:00Z",
  deleted: false,
  hidden: false,
  reactions: [],
  ...over,
});

function renderChat() {
  return render(
    <MemoryRouter initialEntries={["/grupos/g1"]}>
      <Routes>
        <Route path="/grupos/:id" element={<GroupChat />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("GroupChat: enfeites nas mensagens", () => {
  beforeEach(() => {
    getGroup.mockReset();
    listMessages.mockReset();
  });

  it("chat comum: moldura no rosto e insígnia ao lado do nome do autor", async () => {
    getGroup.mockResolvedValue(group({ mode: "chat" }));
    listMessages.mockResolvedValue([msg({})]);
    const { container } = renderChat();
    await screen.findByText("Oi, gente!");
    const row = container.querySelector(".group-msg:not(.is-mine)") as HTMLElement;
    expect(row.querySelector("img.face-frame")?.getAttribute("src")).toBe(`${window.location.origin}/shop/f-ouro.png`);
    const author = row.querySelector(".group-author") as HTMLElement;
    expect(author.querySelector("img.person-name-badge")?.getAttribute("alt")).toBe("Coruja");
    expect(author.textContent).toContain("Ana");
  });

  it("roleplay: mensagem do personagem sem moldura e sem insígnia", async () => {
    getGroup.mockResolvedValue(group({ mode: "roleplay", members: [member({ user_id: "eu", name: "Eu", cosmetics: null }), member({ rp_character: "Capitu" })] }));
    // Mesmo que a API mandasse os enfeites, a mensagem do personagem não os mostra.
    listMessages.mockResolvedValue([msg({ body: "Olhos de ressaca." })]);
    const { container } = renderChat();
    await screen.findByText("Olhos de ressaca.");
    const row = container.querySelector(".group-msg:not(.is-mine)") as HTMLElement;
    expect(row.textContent).toContain("Capitu");
    expect(row.querySelector("img.face-frame")).toBeNull();
    expect(row.querySelector("img.person-name-badge")).toBeNull();
  });
});

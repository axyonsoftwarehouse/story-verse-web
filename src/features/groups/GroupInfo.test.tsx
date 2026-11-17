import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Group, GroupMember } from "../../lib/groups";
import type { Cosmetics } from "../../lib/shop";
import { GroupInfo } from "./GroupInfo";

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

const group: Group = {
  id: "g1",
  name: "Dom Casmurro RP",
  description: null,
  photo_url: null,
  background: null,
  visibility: "private",
  owner_id: "dono",
  book_key: null,
  book_title: null,
  book_cover: null,
  goal_chapter: null,
  goal_until: null,
  last_message_at: null,
  created_at: "2026-11-01T00:00:00Z",
  member_count: 3,
  is_member: true,
  my_role: "member",
  mode: "roleplay",
  muted: false,
  last_read_id: 0,
  unread: 0,
  invite_code: null,
  last_message_id: null,
  last_author_name: null,
  last_body: null,
  members: [member({ user_id: "eu", name: "Eu", cosmetics: null }), member({ rp_character: "Capitu" }), member({ user_id: "bruno", name: "Bruno" })],
};

describe("GroupInfo: enfeites na lista de membros do roleplay", () => {
  it("quem aparece como personagem fica sem enfeites; quem aparece como si mesmo, com", () => {
    render(
      <MemoryRouter>
        <GroupInfo group={group} me="eu" confirm={vi.fn(async () => false)} onClose={() => {}} onChanged={() => {}} onLeft={() => {}} />
      </MemoryRouter>,
    );
    const capitu = screen.getByText("Capitu", { exact: false }).closest(".group-member-row") as HTMLElement;
    expect(capitu.querySelector("img.face-frame")).toBeNull();
    expect(capitu.querySelector("img.person-name-badge")).toBeNull();
    expect(capitu.querySelector(".person-name-text")).toBeNull();

    const bruno = screen.getByText("Bruno").closest(".group-member-row") as HTMLElement;
    expect(bruno.querySelector("img.face-frame")).not.toBeNull();
    expect(bruno.querySelector("img.person-name-badge")?.getAttribute("alt")).toBe("Coruja");
  });
});

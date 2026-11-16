import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PersonProfile } from "../../lib/social";

const getPerson = vi.fn();

vi.mock("../auth/useStoredSession", () => ({
  useStoredSession: () => ({ session: { user: { id: "eu" } }, loading: false }),
}));

vi.mock("../groups/groupHelpers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../groups/groupHelpers")>()),
  useGroupsGate: () => ({ ready: true, blocked: null }),
}));

vi.mock("../../lib/social", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/social")>()),
  getPerson: (id: string) => getPerson(id),
  followersOf: vi.fn(async () => []),
  followingOf: vi.fn(async () => []),
  peopleSuggestions: vi.fn(async () => []),
}));

import { PersonProfilePage } from "./PersonProfilePage";

const base: PersonProfile = {
  id: "u1",
  name: "Ana Souza",
  avatar: "",
  photo: null,
  is_following: true,
  follows_me: false,
  is_me: false,
  member_since: "2026-01-10T00:00:00Z",
  content_visible: true,
  followers: 3,
  following: 2,
  connections: 1,
  groups_in_common: 0,
  show_reading: true,
  reading_hidden: false,
  books: [],
  reading_counts: { reading: 0, finished: 0 },
  gifts: [],
  badges: [{ id: "first", emoji: "📖", title: "Primeira página" }],
  badges_total: 10,
  stats: {},
  cosmetics: { frame: { image: "/shop/f-ouro.png", animated: "/shop/f-ouro.webp", tier: "epic" }, badge: null, name_color: null },
  shop_cover: null,
  cover: null,
  badge_shelf: [],
};

function renderProfile(profile: PersonProfile) {
  getPerson.mockResolvedValue(profile);
  return render(
    <MemoryRouter initialEntries={["/pessoas/u1"]}>
      <Routes>
        <Route path="/pessoas/:id" element={<PersonProfilePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const coverOf = (container: HTMLElement) => (container.querySelector(".person-cover") as HTMLElement | null)?.style.backgroundImage ?? null;

describe("PersonProfilePage: capa, insígnias e moldura", () => {
  beforeEach(() => {
    getPerson.mockReset();
  });

  it("capa comprada vence a enviada", async () => {
    const { container } = renderProfile({ ...base, shop_cover: "/shop/c-mar.webp", cover: "https://cdn.example.com/u1/cover.jpg" });
    await screen.findByRole("heading", { level: 1 });
    expect(coverOf(container)).toContain(`${window.location.origin}/shop/c-mar.webp`);
    expect(container.querySelector(".person-hero")?.classList.contains("has-cover")).toBe(true);
  });

  it("sem capa comprada usa a foto de capa enviada", async () => {
    const { container } = renderProfile({ ...base, cover: "https://cdn.example.com/u1/cover.jpg" });
    await screen.findByRole("heading", { level: 1 });
    expect(coverOf(container)).toContain("https://cdn.example.com/u1/cover.jpg");
  });

  it("estante de insígnias com 2 itens, separada das conquistas", async () => {
    renderProfile({
      ...base,
      badge_shelf: [
        { id: "b1", name: "Leitora voraz", image: "/shop/b-voraz.webp" },
        { id: "b2", name: "Coruja", image: "/shop/b-coruja.webp" },
      ],
    });
    const title = await screen.findByRole("heading", { name: /Insígnias/ });
    const section = title.closest("section") as HTMLElement;
    expect(within(section).getAllByRole("img")).toHaveLength(2);
    expect(within(section).getByAltText("Coruja").getAttribute("src")).toBe(`${window.location.origin}/shop/b-coruja.webp`);
    const conquistas = screen.getByRole("heading", { name: /Conquistas/ }).closest("section") as HTMLElement;
    expect(conquistas).not.toBe(section);
    expect(within(conquistas).getByText("Primeira página")).toBeInTheDocument();
  });

  it("sem insígnias, a seção não aparece", async () => {
    renderProfile(base);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("heading", { name: /Insígnias/ })).toBeNull();
  });

  it("conteúdo fechado: sem capa e sem insígnias", async () => {
    const { container } = renderProfile({
      ...base,
      is_private: true,
      is_following: false,
      content_visible: false,
      shop_cover: "/shop/c-mar.webp",
      cover: "https://cdn.example.com/u1/cover.jpg",
      badge_shelf: [{ id: "b1", name: "Coruja", image: "/shop/b-coruja.webp" }],
    });
    await screen.findByRole("heading", { level: 1 });
    expect(coverOf(container)).toBeNull();
    expect(screen.queryByRole("heading", { name: /Insígnias/ })).toBeNull();
  });

  it("moldura do perfil pode ser a animada", async () => {
    const { container } = renderProfile(base);
    await screen.findByRole("heading", { level: 1 });
    expect(container.querySelector(".person-hero img.face-frame")?.getAttribute("src")).toBe(`${window.location.origin}/shop/f-ouro.webp`);
  });
});

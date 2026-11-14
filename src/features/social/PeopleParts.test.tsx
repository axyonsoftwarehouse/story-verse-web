import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { Person } from "../../lib/social";
import { PersonRow } from "./PeopleParts";

const person: Person = {
  id: "u1",
  name: "Ana",
  avatar: "",
  photo: null,
  is_following: false,
  follows_me: false,
  cosmetics: {
    frame: { image: "/shop/f-ouro.png", animated: null, tier: "rare" },
    badge: { image: "/shop/b-livro.png", name: "Leitora" },
    name_color: ["#ff8800"],
  },
};

describe("PersonRow com enfeites da loja", () => {
  it("desenha a moldura no rosto e a insígnia ao lado do nome", () => {
    const { container } = render(
      <MemoryRouter>
        <PersonRow person={person} me="eu" onChange={() => {}} />
      </MemoryRouter>,
    );
    expect(container.querySelector("img.face-frame")?.getAttribute("src")).toBe(`${window.location.origin}/shop/f-ouro.png`);
    expect(container.querySelector("img.person-name-badge")?.getAttribute("alt")).toBe("Leitora");
    expect((container.querySelector(".person-name-text") as HTMLElement).style.color).toBe("rgb(255, 136, 0)");
  });

  it("sem enfeites, nada de moldura", () => {
    const { container } = render(
      <MemoryRouter>
        <PersonRow person={{ ...person, cosmetics: null }} me="eu" onChange={() => {}} />
      </MemoryRouter>,
    );
    expect(container.querySelector("img.face-frame")).toBeNull();
    expect(container.textContent).toContain("Ana");
  });
});

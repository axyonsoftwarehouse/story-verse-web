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

describe("PersonRow com capa do perfil", () => {
  it("desenha a faixa 3:1 com a capa da loja e o rosto por cima", () => {
    const { container } = render(
      <MemoryRouter>
        <PersonRow person={{ ...person, shop_cover: "/shop/capa-noite-estrelada.webp" }} me="eu" onChange={() => {}} />
      </MemoryRouter>,
    );
    expect((container.querySelector(".people-row") as HTMLElement).className).toContain("has-cover");
    const img = container.querySelector(".people-row-cover img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(`${window.location.origin}/shop/capa-noite-estrelada.webp`);
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(container.querySelector(".people-row-body")).not.toBeNull();
  });

  it("usa a capa enviada quando não há item da loja", () => {
    const enviada = "https://api.example.test/api/v1/storage/public/profile-media/u1/cover.png";
    const { container } = render(
      <MemoryRouter>
        <PersonRow person={{ ...person, cover: enviada }} me="eu" onChange={() => {}} />
      </MemoryRouter>,
    );
    expect((container.querySelector(".people-row-cover img") as HTMLImageElement).getAttribute("src")).toBe(enviada);
  });

  it("sem capa (ou perfil privado), o card fica sem faixa", () => {
    const { container } = render(
      <MemoryRouter>
        <PersonRow person={person} me="eu" onChange={() => {}} />
      </MemoryRouter>,
    );
    expect((container.querySelector(".people-row") as HTMLElement).className).not.toContain("has-cover");
    expect(container.querySelector(".people-row-cover")).toBeNull();
  });
});

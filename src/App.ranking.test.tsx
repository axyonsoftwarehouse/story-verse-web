import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PersonAvatar, RankingRow } from "./App";
import { nameColorStyle } from "./lib/shop";

describe("RankingRow com enfeites", () => {
  it("aplica a cor de nome comprada e desenha a moldura", () => {
    const { container } = render(
      <ol>
        <RankingRow
          entry={{
            place: 4,
            user_id: "u1",
            name: "Ana",
            avatar: null,
            photo: null,
            minutes: 120,
            is_me: false,
            cosmetics: { frame: { image: "/shop/f-ouro.png", animated: "/shop/f-ouro.webp", tier: "epic" }, badge: null, name_color: ["#ff8800", "#ffcc00"] },
          }}
          giftsReceived={0}
        />
      </ol>,
    );
    const text = container.querySelector(".ranking-name .person-name-text") as HTMLElement;
    expect(text.textContent).toBe("Ana");
    // O jsdom normaliza as cores: compara com o mesmo estilo aplicado num elemento.
    const expected = document.createElement("span");
    Object.assign(expected.style, nameColorStyle(["#ff8800", "#ffcc00"]));
    expect(text.style.backgroundImage).toBe(expected.style.backgroundImage);
    expect(text.style.backgroundImage).toContain("linear-gradient");
    // Fora do perfil a moldura fica parada.
    expect(container.querySelector(".ranking-face img.face-frame")?.getAttribute("src")).toBe(`${window.location.origin}/shop/f-ouro.png`);
  });
});

describe("PersonAvatar com moldura (perfil próprio e ranking)", () => {
  it("ganha has-frame e a moldura só quando há moldura", () => {
    const framed = render(
      <PersonAvatar
        id="eu"
        name="Eu"
        avatar={null}
        photo={null}
        className="profile-avatar"
        cosmetics={{ frame: { image: "/shop/f-ouro.png", animated: null, tier: "rare" }, badge: null, name_color: null }}
        animate
      />,
    ).container.firstElementChild as HTMLElement;
    expect(framed.classList.contains("has-frame")).toBe(true);
    expect(framed.querySelector("img.face-frame")).not.toBeNull();

    const plain = render(<PersonAvatar id="eu" name="Eu" avatar={null} photo={null} className="profile-avatar" />).container.firstElementChild as HTMLElement;
    expect(plain.classList.contains("has-frame")).toBe(false);
    expect(plain.querySelector("img.face-frame")).toBeNull();
  });
});

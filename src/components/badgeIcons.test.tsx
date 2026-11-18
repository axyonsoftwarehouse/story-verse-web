import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BadgeIcon, GiftIcon } from "./badgeIcons";

describe("BadgeIcon (conquistas)", () => {
  it("desenha o ícone vetorial da conquista pelo id", () => {
    const { container } = render(<BadgeIcon id="streak-7" size={30} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("width")).toBe("30");
    expect(svg?.getAttribute("stroke")).toBe("currentColor");
    expect(svg?.querySelectorAll("path").length).toBeGreaterThan(0);
  });

  it("cobre todas as conquistas do catálogo", async () => {
    const { achievements } = await import("../lib/achievements");
    const lista = achievements({
      totalMinutes: 0,
      messagesSent: 0,
      bestStreak: 0,
      finishedBooks: 0,
      marks: 0,
      charactersTalked: 0,
      giftsReceived: 0,
      shelf: { ratings: 0, reviews: 0, genresFinished: 0, finishedThisYear: 0 },
    });
    expect(lista.length).toBeGreaterThanOrEqual(17);
    for (const conquista of lista) {
      const { container } = render(<BadgeIcon id={conquista.id} />);
      const svg = container.querySelector("svg");
      // o selo genérico também é svg; o que não pode é cair em texto (emoji)
      expect(svg, `sem ícone para ${conquista.id}`).not.toBeNull();
      expect(container.textContent?.trim()).toBe("");
    }
  });

  it("id desconhecido cai no selo genérico, ainda vetorial", () => {
    const { container } = render(<BadgeIcon id="conquista-que-nao-existe" />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.textContent?.trim()).toBe("");
  });
});

describe("GiftIcon (presentes)", () => {
  it("desenha o ícone do presente pelo id do catálogo", () => {
    const { container } = render(<GiftIcon id="trofeu" emoji="🏆" />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.textContent).toBe("");
  });

  it("coração e flor têm cor própria, não a do tema", () => {
    const heart = render(<GiftIcon id="coracao" emoji="❤️" />).container.querySelector("svg");
    const flower = render(<GiftIcon id="flor" emoji="🌸" />).container.querySelector("svg");
    expect(heart?.style.color).toBe("rgb(229, 72, 77)");
    expect(flower?.style.color).toBe("rgb(229, 107, 147)");
    expect(heart?.style.color).not.toBe(flower?.style.color);
  });

  it("presente novo, sem desenho, mantém o emoji do banco", () => {
    const { container } = render(<GiftIcon id="presente-novo" emoji="🦄" />);
    expect(container.querySelector("svg")).toBeNull();
    expect(container.textContent).toBe("🦄");
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Cosmetics } from "../../lib/shop";
import { PersonName } from "./PersonName";

const base: Cosmetics = { frame: null, badge: null, name_color: null };

describe("PersonName", () => {
  it("nome longo trunca e a insígnia continua presente com o nome acessível", () => {
    const cosmetics: Cosmetics = { ...base, badge: { image: "/shop/b-estrela.png", name: "Estrela" } };
    const name = "A".repeat(80);
    const { container } = render(<PersonName name={name} cosmetics={cosmetics} />);
    const label = container.querySelector(".person-name-text");
    expect(label?.textContent).toBe(name);
    const badge = screen.getByAltText("Estrela") as HTMLImageElement;
    expect(badge.className).toContain("person-name-badge");
    expect(badge.getAttribute("src")).toBe(`${window.location.origin}/shop/b-estrela.png`);
    expect(label?.nextElementSibling).toBe(badge);
  });

  it("cor de nome com duas cores vira degradê no texto", () => {
    const cosmetics: Cosmetics = { ...base, name_color: ["#ff0000", "#0000ff"] };
    const { container } = render(<PersonName name="Ana" cosmetics={cosmetics} />);
    const label = container.querySelector(".person-name-text") as HTMLElement;
    expect(label.style.backgroundImage).toContain("rgb(255, 0, 0)");
    expect(label.style.backgroundImage).toContain("rgb(0, 0, 255)");
  });

  it("sem enfeites mostra só o nome, e insígnia com URL inválida é ignorada", () => {
    const bad: Cosmetics = { ...base, badge: { image: "javascript:x", name: "X" } };
    const { container } = render(<PersonName name="Ana" cosmetics={bad} className="extra" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.firstElementChild?.className).toContain("extra");
    expect(container.textContent).toBe("Ana");
  });
});

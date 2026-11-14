import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Cosmetics } from "../../lib/shop";
import { PersonFace } from "./GroupParts";

const originalMatchMedia = window.matchMedia;

function setReducedMotion(reduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({ matches: reduced && query.includes("prefers-reduced-motion"), media: query })),
  });
}

afterEach(() => {
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: originalMatchMedia });
});

const cosmetics: Cosmetics = {
  frame: { image: "/shop/f-ouro.png", animated: "/shop/f-ouro.webp", tier: "rare" },
  badge: null,
  name_color: null,
};

describe("PersonFace com moldura", () => {
  it("desenha a moldura parada sobre o rosto", () => {
    setReducedMotion(false);
    const { container } = render(<PersonFace id="1" name="Ana" cosmetics={cosmetics} />);
    const img = container.querySelector("img.face-frame") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(`${window.location.origin}/shop/f-ouro.png`);
    expect(img.getAttribute("alt")).toBe("");
  });

  it("com animate e sem redução de movimento usa a moldura animada", () => {
    setReducedMotion(false);
    const { container } = render(<PersonFace id="1" name="Ana" cosmetics={cosmetics} animate />);
    expect(container.querySelector("img.face-frame")?.getAttribute("src")).toBe(`${window.location.origin}/shop/f-ouro.webp`);
  });

  it("com redução de movimento fica na moldura parada mesmo com animate", () => {
    setReducedMotion(true);
    const { container } = render(<PersonFace id="1" name="Ana" cosmetics={cosmetics} animate />);
    expect(container.querySelector("img.face-frame")?.getAttribute("src")).toBe(`${window.location.origin}/shop/f-ouro.png`);
  });

  it("não renderiza a moldura se a URL é inválida", () => {
    const bad: Cosmetics = { ...cosmetics, frame: { image: "javascript:x", animated: null, tier: "common" } };
    const { container } = render(<PersonFace id="1" name="Ana" cosmetics={bad} />);
    expect(container.querySelector("img.face-frame")).toBeNull();
  });

  it("a caixa do avatar não muda com a moldura", () => {
    setReducedMotion(false);
    const plain = render(<PersonFace id="1" name="Ana" size="sm" />).container.firstElementChild as HTMLElement;
    const framed = render(<PersonFace id="1" name="Ana" size="sm" cosmetics={cosmetics} />).container.firstElementChild as HTMLElement;
    expect(framed.className).toBe(plain.className);
    expect(framed.className).toContain("group-face-sm");
    expect(framed.getAttribute("aria-hidden")).toBe("true");
    expect(framed.querySelector("img.face-frame")?.parentElement).toBe(framed);
  });
});

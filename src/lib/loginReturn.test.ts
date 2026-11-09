import { describe, expect, it } from "vitest";
import { loginHref, safeLoginReturn } from "./loginReturn";

describe("safeLoginReturn", () => {
  it("aceita as páginas de assinatura e de audiolivro", () => {
    expect(safeLoginReturn("/assinar")).toBe("/assinar");
    expect(safeLoginReturn("/conta/assinatura")).toBe("/conta/assinatura");
    expect(safeLoginReturn("/ouvir/cat:1")).toBe("/ouvir/cat:1");
    expect(safeLoginReturn("/ouvir/gb%3A1342")).toBe("/ouvir/gb%3A1342");
  });

  it("recusa qualquer outro destino", () => {
    expect(safeLoginReturn(null)).toBeNull();
    expect(safeLoginReturn("")).toBeNull();
    expect(safeLoginReturn("https://invasor.example")).toBeNull();
    expect(safeLoginReturn("//invasor.example")).toBeNull();
    expect(safeLoginReturn("/ouvir/")).toBeNull();
    expect(safeLoginReturn("/ouvir/a/b")).toBeNull();
    expect(safeLoginReturn("/ouvir/a?x=1")).toBeNull();
    expect(safeLoginReturn("/ouvir/\\invasor.example")).toBeNull();
  });
});

describe("loginHref", () => {
  it("monta o link de entrar com o retorno codificado", () => {
    const href = loginHref("/ouvir/cat:1");
    expect(href.startsWith("/?login=1&retorno=")).toBe(true);
    expect(new URLSearchParams(href.slice(2)).get("retorno")).toBe("/ouvir/cat:1");
  });
});

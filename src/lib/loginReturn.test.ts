import { describe, expect, it } from "vitest";
import { authModalFromUrl, loginHref, safeLoginReturn } from "./loginReturn";

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

  it("criar conta usa ?cadastro=1 e destino desconhecido fica de fora", () => {
    expect(loginHref("/biblioteca", "register")).toBe("/?cadastro=1&retorno=%2Fbiblioteca");
    expect(loginHref("https://invasor.example")).toBe("/?login=1");
  });
});

describe("subpáginas com o topo do site (U3)", () => {
  it("aceita biblioteca, audiolivros, fichas e páginas legais", () => {
    for (const path of ["/biblioteca", "/ouvir", "/termos", "/privacidade", "/cancelamento", "/biblioteca/cat:1"]) {
      expect(safeLoginReturn(path)).toBe(path);
    }
    expect(safeLoginReturn("/biblioteca/a/b")).toBeNull();
  });
});

describe("authModalFromUrl", () => {
  it("lê ?login=1 e ?cadastro=1", () => {
    expect(authModalFromUrl("?login=1&retorno=/assinar")).toBe("login");
    expect(authModalFromUrl("?cadastro=1")).toBe("register");
    expect(authModalFromUrl("?abrir=cat:1")).toBeNull();
  });
});

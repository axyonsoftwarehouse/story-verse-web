import { describe, expect, it } from "vitest";
import { bioLength, bioProblem, normalizeBio } from "./profileBio";

describe("normalizeBio", () => {
  it("limpa espaços e linhas em branco a mais, como a API", () => {
    expect(normalizeBio("  Leitora   de\tfantasia \r\n\r\n\r\n\n  Café e livros  ")).toBe("Leitora de fantasia\n\nCafé e livros");
    expect(normalizeBio("   \n  ")).toBe("");
  });

  it("tira caracteres invisíveis e mantém emoji composto", () => {
    expect(normalizeBio("o\u0000i​")).toBe("oi");
    expect(normalizeBio("👩‍👧")).toBe("👩‍👧");
  });
});

describe("bioProblem", () => {
  it("emoji conta como um caractere", () => {
    expect(bioLength("📚".repeat(160))).toBe(160);
    expect(bioProblem("📚".repeat(160))).toBeNull();
    expect(bioProblem("📚".repeat(161))).toMatch(/160 caracteres/);
  });

  it("limita a 4 linhas", () => {
    expect(bioProblem("a\nb\nc\nd")).toBeNull();
    expect(bioProblem("a\nb\nc\nd\ne")).toMatch(/4 linhas/);
  });
});

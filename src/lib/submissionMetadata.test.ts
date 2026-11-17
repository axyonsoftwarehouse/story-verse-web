import { describe, expect, it } from "vitest";
import { looksLikeFileName, metadataProblem, metadataWarning } from "./submissionMetadata";

describe("submissionMetadata", () => {
  it("aceita título e autor de verdade", () => {
    expect(metadataProblem("Dom Casmurro", "Machado de Assis")).toBeNull();
    expect(metadataProblem("O Hobbit", "J. R. R. Tolkien")).toBeNull();
    expect(metadataProblem("1984", "George Orwell")).toBeNull();
  });

  it("barra os nomes de arquivo vistos na vitrine de produção", () => {
    expect(looksLikeFileName("Morte_DiaValePenaViver_FINAL.indd")).toBe(true);
    expect(looksLikeFileName("FLORES, Coiote QueDeusTeriaPiedadeDeNos[2025]")).toBe(true);
    expect(looksLikeFileName("meu livro.PDF")).toBe(true);
    expect(looksLikeFileName("Dom Casmurro")).toBe(false);
    expect(metadataProblem("Morte_DiaValePenaViver_FINAL.indd", "Alguém")).toMatch(/nome de arquivo/);
  });

  it("exige título e um autor que identifique alguém", () => {
    expect(metadataProblem("  ", "Fulano")).toBe("Informe o título do livro.");
    expect(metadataProblem("Mulheres que correm com os lobos", "V")).toBe("Informe o autor do livro.");
    expect(metadataProblem("Livro", null)).toBe("Informe o autor do livro.");
    expect(metadataProblem("Livro", "Autor não informado")).toBe("Informe o autor do livro.");
  });

  it("avisa, sem barrar, título todo em maiúsculas", () => {
    expect(metadataWarning("CLARISSA PINKOLA ESTES")).toMatch(/maiúsculas/);
    expect(metadataWarning("IT")).toBeNull();
    expect(metadataWarning("Dom Casmurro")).toBeNull();
    expect(metadataWarning("1984")).toBeNull();
  });
});

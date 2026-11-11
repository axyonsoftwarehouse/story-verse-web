import { describe, expect, it } from "vitest";
import { LEGAL_HOLDER, LEGAL_HOLDER_NAME } from "./holder";

describe("identificação do fornecedor (S6)", () => {
  it("o rodapé mostra só o nome, sem CPF", () => {
    expect(LEGAL_HOLDER_NAME).toBe("Werner Saboia");
    expect(LEGAL_HOLDER_NAME).not.toMatch(/CPF|\d{3}\.\d{3}\.\d{3}/);
  });

  it("as páginas legais continuam com o CPF do titular", () => {
    expect(LEGAL_HOLDER).toMatch(/CPF 857\.167\.403-59/);
  });
});

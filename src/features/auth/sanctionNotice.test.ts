import { describe, expect, it } from "vitest";
import { sanctionMessage, warningMessage } from "./sanctionNotice";

describe("aviso de sanção", () => {
  it("descreve suspensão com prazo e motivo", () => {
    const text = sanctionMessage({
      kind: "suspension",
      reason: "Pagamento em atraso.",
      expiresAt: "2026-10-30T12:00:00Z",
    });
    expect(text).toContain("Conta suspensa até");
    expect(text).toContain("Pagamento em atraso.");
    expect(text).toContain("Fale com o suporte.");
  });

  it("descreve banimento sem prazo", () => {
    const text = sanctionMessage({ kind: "ban", reason: "Descumprimento grave." });
    expect(text).toContain("Conta banida.");
    expect(text).not.toContain("até");
  });

  it("não inclui detalhe técnico quando o corpo vem vazio", () => {
    expect(sanctionMessage(null)).toBe("Conta bloqueada. Fale com o suporte.");
  });

  it("monta o aviso de warning", () => {
    expect(warningMessage("Leia as regras.")).toBe("Aviso da moderação: Leia as regras.");
    expect(warningMessage(null)).toBe("Você recebeu um aviso da moderação.");
  });
});

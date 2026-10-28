import { describe, expect, it } from "vitest";
import type { AuditEntry } from "../../lib/adminAudit";
import { actionLabel, actorLabel, metadataLines } from "./auditFormat";

describe("formatação da auditoria", () => {
  it("traduz ações conhecidas e mantém as desconhecidas", () => {
    expect(actionLabel("feature.set")).toBe("Feature alterada");
    expect(actionLabel("acao.nova")).toBe("acao.nova");
  });

  it("mostra script na VPS quando não há ator", () => {
    expect(actorLabel({ actorId: null, actorName: null } as AuditEntry)).toBe("script na VPS");
  });

  it("formata metadados simples e aninhados", () => {
    expect(metadataLines({ feature: "library", enabled: true })).toEqual([
      "feature: library",
      "enabled: sim",
    ]);
    expect(metadataLines({ a: { b: 1 } })).toEqual(['a: {"b":1}']);
    expect(metadataLines(null)).toEqual([]);
  });
});

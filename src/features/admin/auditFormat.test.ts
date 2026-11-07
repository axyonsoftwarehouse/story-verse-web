import { describe, expect, it } from "vitest";
import type { AuditEntry } from "../../lib/adminAudit";
import { actionLabel, actorLabel, metadataLines } from "./auditFormat";

describe("formatação da auditoria", () => {
  it("traduz ações conhecidas e mantém as desconhecidas", () => {
    expect(actionLabel("feature.set")).toBe("Feature alterada");
    expect(actionLabel("acao.nova")).toBe("acao.nova");
    // A visão geral e o financeiro gravam a série do gráfico; antes aparecia o código cru.
    expect(actionLabel("billing.series")).toBe("Gráfico do financeiro consultado");
    // Audiolivros: o QA tinha estes códigos crus na auditoria.
    expect(actionLabel("catalog.audio.create")).toBe("Audiolivro criado");
    expect(actionLabel("catalog.audio.upload")).toBe("Áudio enviado");
    expect(actionLabel("catalog.audio.chapter.create")).toBe("Capítulo de áudio criado");
    expect(actionLabel("catalog.audio.publish")).toBe("Audiolivro publicado");
    expect(actionLabel("catalog.audio.delete")).toBe("Audiolivro apagado");
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

import type { AuditEntry } from "../../lib/adminAudit";

const ACTION_LABEL: Record<string, string> = {
  "feature.set": "Feature alterada",
  "role.grant": "Papel concedido",
  "role.revoke": "Papel retirado",
  "user.view": "Conta consultada",
  "user.sessions.revoke": "Sessões encerradas",
  "admin.promote": "Promovido a superadmin",
  "admin.demote": "Deixou de ser superadmin",
  "book_submission.review": "Envio revisado",
  "book_submission.delete": "Envio apagado",
  "book_submission.cover": "Capa trocada",
  "forum.report.resolve": "Denúncia resolvida",
  "forum.topic.moderate": "Tópico moderado",
  "forum.reply.moderate": "Resposta moderada",
};

export function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action;
}

export function actorLabel(entry: Pick<AuditEntry, "actorId" | "actorName">): string {
  if (!entry.actorId) return "script na VPS";
  return entry.actorName ?? entry.actorId;
}

function formatValue(value: unknown): string {
  if (value === true) return "sim";
  if (value === false) return "não";
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function metadataLines(metadata: unknown): string[] {
  if (metadata === null || metadata === undefined) return [];
  if (typeof metadata !== "object" || Array.isArray(metadata)) return [formatValue(metadata)];
  return Object.entries(metadata as Record<string, unknown>).map(
    ([key, value]) => `${key}: ${formatValue(value)}`,
  );
}

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
  "forum.reply.accept": "Resposta aceita",
  "sanction.create": "Sanção aplicada",
  "sanction.revoke": "Sanção revogada",
  "catalog.create": "Livro cadastrado",
  "catalog.update": "Livro editado",
  "catalog.delete": "Livro apagado",
  "catalog.text": "Texto do livro trocado",
  "catalog.import": "Importação em lote",
  "collection.create": "Coleção criada",
  "collection.update": "Coleção editada",
  "collection.delete": "Coleção apagada",
  "collection.books": "Livros da coleção alterados",
  "billing.summary": "Financeiro consultado",
  "billing.view": "Assinatura consultada",
  "billing.grant": "Acesso manual concedido",
  "billing.grant.revoke": "Acesso manual retirado",
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

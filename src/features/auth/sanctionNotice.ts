/** Textos do bloqueio de login; nada de e-mail/UUID ou detalhe técnico. */

export type SanctionErrorBody = {
  kind?: unknown;
  reason?: unknown;
  expiresAt?: unknown;
};

export function formatSanctionDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function sanctionMessage(body: SanctionErrorBody | null | undefined): string {
  const kind = body?.kind === "ban" ? "Conta banida" : body?.kind === "suspension" ? "Conta suspensa" : "Conta bloqueada";
  const expiresAt = typeof body?.expiresAt === "string" ? body.expiresAt : null;
  const until = expiresAt ? ` até ${formatSanctionDate(expiresAt)}` : "";
  const reason = typeof body?.reason === "string" && body.reason.trim() ? ` Motivo: ${body.reason.trim()}.` : "";
  return `${kind}${until}.${reason} Fale com o suporte.`;
}

export function warningMessage(reason: string | null | undefined): string {
  return reason?.trim()
    ? `Aviso da moderação: ${reason.trim()}`
    : "Você recebeu um aviso da moderação.";
}

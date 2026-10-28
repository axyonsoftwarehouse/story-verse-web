import type { ShelfEntry } from "./library";
import type { LocalShelfEntry, ShelfPending } from "./libraryStore";

/**
 * Junta a entrada deste aparelho (com pendências) e a do servidor, campo a campo (spec 9.3):
 * - status: a pendência vence se for explícita e mais nova; "lendo" automático nunca troca
 *   "terminado"/"abandonado" do servidor;
 * - nota, resenha e abandono: vence o mais recente;
 * - progresso: o maior; início: a data mais antiga; conclusão: a mais recente.
 * Devolve a entrada a mostrar e o que ainda precisa subir.
 */
export function mergeShelfEntry(local: LocalShelfEntry, server: ShelfEntry): { entry: ShelfEntry; pending: ShelfPending } {
  const p = local.pending;
  const localNewer = (local.pendingAt ?? 0) >= serverTime(server.updatedAt);
  const out: ShelfPending = {};

  if (p.status !== undefined && p.status !== server.status) {
    const settled = server.status === "finished" || server.status === "abandoned";
    if (p.auto ? !settled : localNewer) {
      out.status = p.status;
      out.auto = p.auto;
    }
  }
  for (const field of ["rating", "review", "dnfReason", "dnfNote"] as const) {
    if (p[field] !== undefined && p[field] !== server[field] && localNewer) {
      (out as Record<string, unknown>)[field] = p[field];
    }
  }
  if (typeof p.progressPercent === "number" && p.progressPercent > (server.progressPercent ?? -1)) {
    out.progressPercent = p.progressPercent;
    if (p.progressLabel !== undefined) out.progressLabel = p.progressLabel;
  }
  if (p.startedOn && (!server.startedOn || p.startedOn < server.startedOn)) out.startedOn = p.startedOn;
  if (p.finishedOn && (!server.finishedOn || p.finishedOn > server.finishedOn)) out.finishedOn = p.finishedOn;
  for (const field of ["title", "author", "coverUrl", "genre", "language", "series", "seriesIndex"] as const) {
    if (p[field] !== undefined && p[field] !== server[field]) (out as Record<string, unknown>)[field] = p[field];
  }

  const { auto: _auto, ...values } = out;
  void _auto;
  return { entry: { ...server, ...values }, pending: out };
}

/** Milissegundos de um `updatedAt` do servidor (texto do Postgres ou ISO). 0 se não der para ler. */
export function serverTime(updatedAt: string | null | undefined): number {
  if (!updatedAt) return 0;
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)?$/.exec(updatedAt.trim());
  if (!match) return 0;
  const [, date, time, fraction = "", zone = "Z"] = match;
  const millis = (fraction + "000").slice(0, 3);
  const offset = zone === "Z" ? "Z" : zone.length === 3 ? `${zone}:00` : zone.includes(":") ? zone : `${zone.slice(0, 3)}:${zone.slice(3)}`;
  const parsed = Date.parse(`${date}T${time}.${millis}${offset}`);
  return Number.isNaN(parsed) ? 0 : parsed;
}

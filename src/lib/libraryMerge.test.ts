import { describe, expect, it } from "vitest";
import type { ShelfEntry } from "./library";
import { mergeShelfEntry, serverTime } from "./libraryMerge";
import type { LocalShelfEntry, ShelfPending } from "./libraryStore";

const baseEntry: ShelfEntry = {
  bookKey: "gb:55752",
  source: "gutenberg",
  status: "reading",
  rating: null,
  review: null,
  startedOn: null,
  finishedOn: null,
  dnfReason: null,
  dnfNote: null,
  progressPercent: null,
  progressLabel: null,
  title: "Dom Casmurro",
  author: "Machado de Assis",
  coverUrl: null,
  series: null,
  seriesIndex: null,
  genre: null,
  language: "pt",
  updatedAt: "2026-10-22 19:00:00.000000+00",
  version: 1,
  deletedAt: null,
};

function local(fields: Partial<ShelfEntry>, pending: ShelfPending, pendingAt = Date.parse("2026-10-22T20:00:00Z")): LocalShelfEntry {
  return { ...baseEntry, ...fields, ...pending, pending, pendingAt, pendingDelete: false, local: false, touchedAt: pendingAt };
}
const server = (fields: Partial<ShelfEntry>): ShelfEntry => ({ ...baseEntry, version: 2, ...fields });

describe("merge da estante", () => {
  it("abrir o livro em outro aparelho não desfaz 'terminado'", () => {
    const r = mergeShelfEntry(local({}, { status: "reading", auto: true }), server({ status: "finished", finishedOn: "2026-10-01" }));
    expect(r.entry.status).toBe("finished");
    expect(r.pending.status).toBeUndefined();
  });

  it("ação explícita mais nova vence", () => {
    const r = mergeShelfEntry(
      local({}, { status: "reading", auto: false }, Date.parse("2026-10-22T20:00:00Z")),
      server({ status: "abandoned", dnfReason: "slow", updatedAt: "2026-10-22 19:00:00.000000+00" }),
    );
    expect(r.pending.status).toBe("reading");
    expect(r.entry.status).toBe("reading");
  });

  it("ação explícita mais velha perde", () => {
    const r = mergeShelfEntry(
      local({}, { status: "want_to_read", auto: false }, Date.parse("2026-10-22T18:00:00Z")),
      server({ status: "finished", finishedOn: "2026-10-22", updatedAt: "2026-10-22 19:00:00+00" }),
    );
    expect(r.pending.status).toBeUndefined();
    expect(r.entry.status).toBe("finished");
  });

  it("nota: vence a mais recente", () => {
    const older = mergeShelfEntry(local({}, { rating: 3 }, Date.parse("2026-10-22T18:00:00Z")), server({ rating: 5, updatedAt: "2026-10-22 19:00:00+00" }));
    expect(older.entry.rating).toBe(5);
    expect(older.pending.rating).toBeUndefined();
    const newer = mergeShelfEntry(local({}, { rating: 3 }, Date.parse("2026-10-22T20:00:00Z")), server({ rating: 5, updatedAt: "2026-10-22 19:00:00+00" }));
    expect(newer.entry.rating).toBe(3);
    expect(newer.pending.rating).toBe(3);
  });

  it("progresso maior e datas coerentes", () => {
    const r = mergeShelfEntry(
      local({}, { progressPercent: 40, startedOn: "2026-10-05" }),
      server({ progressPercent: 60, startedOn: "2026-10-10" }),
    );
    expect(r.entry.progressPercent).toBe(60);
    expect(r.pending.progressPercent).toBeUndefined();
    expect(r.pending.startedOn).toBe("2026-10-05");
    const later = mergeShelfEntry(local({}, { finishedOn: "2026-10-01" }), server({ finishedOn: "2026-10-20", status: "finished" }));
    expect(later.entry.finishedOn).toBe("2026-10-20");
  });

  it("lê o horário do Postgres", () => {
    expect(serverTime("2026-10-22 21:16:12.123456+00")).toBe(Date.parse("2026-10-22T21:16:12.123Z"));
    expect(serverTime("2026-10-22 21:16:12+00")).toBe(Date.parse("2026-10-22T21:16:12Z"));
    expect(serverTime("2026-10-22T21:16:12.000Z")).toBe(Date.parse("2026-10-22T21:16:12Z"));
    expect(serverTime(null)).toBe(0);
  });
});

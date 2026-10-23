import type { LocalShelfEntry } from "../../lib/libraryStore";

/** Entrada de estante para testes, com um campo variando por vez. */
export function e(fields: Partial<LocalShelfEntry>): LocalShelfEntry {
  return {
    bookKey: "gb:1",
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
    title: "T",
    author: null,
    coverUrl: null,
    series: null,
    seriesIndex: null,
    genre: null,
    language: "pt",
    updatedAt: null,
    version: 0,
    deletedAt: null,
    pending: {},
    pendingAt: null,
    pendingDelete: false,
    local: false,
    touchedAt: 0,
    ...fields,
  };
}

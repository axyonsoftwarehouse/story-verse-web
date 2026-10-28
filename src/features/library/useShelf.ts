import { useMemo, useSyncExternalStore } from "react";
import { shelfEntries, shelfEntry, subscribeShelf, type LocalShelfEntry } from "../../lib/libraryStore";

/**
 * Leitura reativa da estante. O snapshot é o JSON da entrada (texto estável entre leituras iguais),
 * porque o store relê do armazenamento e devolve objetos novos a cada chamada.
 */
export function useShelfEntry(bookKey: string | null): LocalShelfEntry | null {
  const raw = useSyncExternalStore(subscribeShelf, () => (bookKey ? JSON.stringify(shelfEntry(bookKey)) : "null"));
  return useMemo(() => JSON.parse(raw) as LocalShelfEntry | null, [raw]);
}

export function useShelfEntries(): LocalShelfEntry[] {
  const raw = useSyncExternalStore(subscribeShelf, () => JSON.stringify(shelfEntries()));
  return useMemo(() => JSON.parse(raw) as LocalShelfEntry[], [raw]);
}

export const STATUS_LABEL = {
  want_to_read: "Quero ler",
  reading: "Lendo",
  finished: "Terminado",
  abandoned: "Abandonado",
} as const;

/** 4.5 → "4,5" (vírgula, como se escreve no Brasil). */
export function formatRating(value: number): string {
  return String(value).replace(".", ",");
}

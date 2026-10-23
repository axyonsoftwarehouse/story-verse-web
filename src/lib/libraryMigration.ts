import { currentDataOwner, storageForOwner } from "./dataOwner";
import { finishedBooks } from "./finished";
import { todayInBrazil } from "./library";
import { seedShelfEntry, shelfEnabled } from "./libraryStore";
import { progressPct, recentProgress } from "./progress";

const MIGRATED_KEY = "storyverse:shelf-migrated";

/**
 * Primeira abertura com a estante: terminados viram "terminado" (com a data de quando terminou) e
 * começados viram "lendo". Roda uma vez por conta, não sobrescreve nada e não apaga as chaves
 * antigas. Destaques ficam como estão (Fase 2). Devolve quantas entradas criou.
 */
export function migrateLocalShelf(owner: string | null = currentDataOwner()): number {
  if (!shelfEnabled()) return 0;
  const storage = storageForOwner(owner);
  try {
    if (storage.getItem(MIGRATED_KEY) === "1") return 0;
  } catch {
    return 0;
  }
  let created = 0;
  const finishedIds = new Set<string>();
  for (const { book, finishedAt } of finishedBooks()) {
    finishedIds.add(book.id);
    const finishedOn = todayInBrazil(new Date(finishedAt));
    if (seedShelfEntry(book, { status: "finished", finishedOn, progressPercent: 100 }, false)) created++;
  }
  for (const progress of recentProgress(owner)) {
    if (finishedIds.has(progress.book.id)) continue;
    const fields = {
      status: "reading" as const,
      progressPercent: Math.round(progressPct(progress)),
      progressLabel: progress.chapterLabel.slice(0, 200),
    };
    if (seedShelfEntry(progress.book, fields, true)) created++;
  }
  try {
    storage.setItem(MIGRATED_KEY, "1");
  } catch {
    // Sem espaço: roda de novo depois, sem duplicar (não sobrescreve entradas).
  }
  return created;
}

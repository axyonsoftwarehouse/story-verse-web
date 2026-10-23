import type { SupabaseSession } from "./auth";
import { migrateLocalShelf } from "./libraryMigration";
import { setShelfEnabled } from "./libraryStore";
import { startShelfSync } from "./librarySync";

/**
 * Liga ou desliga a estante para a sessão atual (capability `library`). Ligada com sessão:
 * migra os dados antigos uma vez e começa o sync. Devolve a função que para o sync.
 */
export function connectShelf(session: SupabaseSession | null, enabled: boolean): () => void {
  const on = enabled && session !== null;
  setShelfEnabled(on);
  if (!on || !session) return () => {};
  migrateLocalShelf();
  return startShelfSync(session);
}

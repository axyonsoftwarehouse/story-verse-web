import type { SupabaseSession } from "./auth";
import { currentDataOwner } from "./dataOwner";
import { migrateLocalShelf } from "./libraryMigration";
import { setShelfEnabled } from "./libraryStore";
import { startShelfSync } from "./librarySync";

/**
 * Liga ou desliga a estante para a sessão atual (capability `library`). Ligada com sessão:
 * migra os dados antigos uma vez e começa o sync. Devolve a função que para o sync.
 */
export function connectShelf(session: SupabaseSession | null, enabled: boolean): () => void {
  // Só com os dados do aparelho já trocados para a conta da sessão (activateDataOwner terminou).
  const on = enabled && session !== null && currentDataOwner() === session.user.id;
  setShelfEnabled(on);
  if (!on || !session) return () => {};
  migrateLocalShelf();
  return startShelfSync(session);
}

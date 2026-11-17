import { todayInBrazil } from "./library";
import { shelfAchievementInput, shelfEnabled, shelfEntries } from "./libraryStore";

/** "Bom dia" / "Boa tarde" / "Boa noite" pelo relógio do aparelho. */
/** Números da estante para as conquistas (`null` sem a estante: as conquistas dela não aparecem). */
export function shelfAchievements() {
  return shelfEnabled() ? shelfAchievementInput(shelfEntries(), Number(todayInBrazil().slice(0, 4))) : null;
}

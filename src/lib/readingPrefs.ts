import { userStorage } from "./dataOwner";

export type ReadingTheme = "night" | "sepia";

export const FONT_SIZES = [0.95, 1.05, 1.17, 1.3, 1.45, 1.6];

export const PREFS_KEY = "storyverse:reading-prefs";

/** Luz noturna: 0 desligada, 1 suave, 2 forte (filtro âmbar que corta a luz azul). */
export type NightLight = 0 | 1 | 2;

export const NIGHT_LIGHT_LABELS = ["desligada", "suave", "forte"] as const;

export function loadPrefs(): { theme: ReadingTheme; fontStep: number; translate: boolean; nightLight: NightLight } {
  try {
    const raw = userStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { theme?: string; fontStep?: number; translate?: boolean; nightLight?: number };
      return {
        theme: p.theme === "sepia" ? "sepia" : "night",
        translate: p.translate === true,
        nightLight: p.nightLight === 1 || p.nightLight === 2 ? p.nightLight : 0,
        fontStep:
          typeof p.fontStep === "number" && p.fontStep >= 0 && p.fontStep < FONT_SIZES.length
            ? p.fontStep
            : 1,
      };
    }
  } catch {
    // Sem armazenamento disponível: usa o padrão.
  }
  return { theme: "night", fontStep: 1, translate: false, nightLight: 0 };
}

export type ReadingPrefs = ReturnType<typeof loadPrefs>;

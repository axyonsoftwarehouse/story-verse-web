import { APP_THEMES, type AppThemeId } from "./appTheme";

/** Paletas do perfil público — mesmas opções do app, mas só afetam a página de perfil. */
export const PROFILE_THEMES = APP_THEMES;
export type ProfileThemeId = AppThemeId;
export const DEFAULT_PROFILE_THEME: ProfileThemeId = "dourado";

/** Tom do brilho decorativo (HSL) para combinar com a paleta escolhida. */
export const PROFILE_THEME_HUE: Record<ProfileThemeId, number> = {
  dourado: 40,
  esmeralda: 155,
  rosa: 335,
  oceano: 210,
  lavanda: 268,
};

export function normalizeProfileTheme(raw: unknown): ProfileThemeId {
  const id = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return PROFILE_THEMES.some((t) => t.id === id) ? (id as ProfileThemeId) : DEFAULT_PROFILE_THEME;
}
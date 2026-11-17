import { userStorage } from "./dataOwner";

/**
 * Cor do app (Ajustes › Cor do app): cada tema é uma paleta inteira em index.css
 * (`:root[data-accent=…]`), para destaque, fundo e cartões combinarem.
 * Com API, também grava `profile_theme` na conta para o perfil em Pessoas.
 */
export const APP_THEMES = [
  { id: "dourado", label: "Dourado", swatch: ["#e4b86a", "#9bc4b5"], bg: "#0c0a08" },
  { id: "esmeralda", label: "Esmeralda", swatch: ["#6fcf9f", "#d8c48a"], bg: "#08100c" },
  { id: "rosa", label: "Rosa", swatch: ["#ee9fbf", "#b8a6e0"], bg: "#0f0a0c" },
  { id: "oceano", label: "Oceano", swatch: ["#7fb6ec", "#9fd6c9"], bg: "#080b10" },
  { id: "lavanda", label: "Lavanda", swatch: ["#b9a2f0", "#f0b8c8"], bg: "#0c0a10" },
] as const;

export type AppThemeId = (typeof APP_THEMES)[number]["id"];

export const DEFAULT_APP_THEME: AppThemeId = "dourado";

/** Tom do brilho no perfil público (Pessoas), alinhado à paleta do app. */
export const APP_THEME_HUE: Record<AppThemeId, number> = {
  dourado: 40,
  esmeralda: 155,
  rosa: 335,
  oceano: 210,
  lavanda: 268,
};

/** Valor vindo da conta (`user_metadata.profile_theme` ou resposta social). */
export function appThemeFromMetadata(raw: unknown): AppThemeId {
  const id = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return APP_THEMES.some((t) => t.id === id) ? (id as AppThemeId) : DEFAULT_APP_THEME;
}

const KEY = "storyverse:app-theme";

export function loadAppTheme(): AppThemeId {
  try {
    const v = userStorage.getItem(KEY);
    return APP_THEMES.some((t) => t.id === v) ? (v as AppThemeId) : "dourado";
  } catch {
    return "dourado";
  }
}

/** Pinta o app com o tema (e a barra do navegador/celular junto). */
export function applyAppTheme(id: AppThemeId = loadAppTheme()) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (id === "dourado") delete root.dataset.accent;
  else root.dataset.accent = id;
  const bg = APP_THEMES.find((t) => t.id === id)?.bg ?? "#0c0a08";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
}

export function saveAppTheme(id: AppThemeId) {
  try {
    userStorage.setItem(KEY, id);
  } catch {
    // Sem armazenamento: vale só até fechar.
  }
  applyAppTheme(id);
}

/** Aplica na tela e no aparelho a cor gravada na conta (ex.: após entrar ou em outro dispositivo). */
export function syncAppThemeFromAccount(metadata?: Record<string, unknown> | null) {
  saveAppTheme(appThemeFromMetadata(metadata?.profile_theme));
}

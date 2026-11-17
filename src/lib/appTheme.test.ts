import { describe, expect, it } from "vitest";
import { appThemeFromMetadata, APP_THEMES, DEFAULT_APP_THEME } from "./appTheme";

describe("appThemeFromMetadata", () => {
  it("cai no padrão quando vazio ou inválido", () => {
    expect(appThemeFromMetadata(undefined)).toBe(DEFAULT_APP_THEME);
    expect(appThemeFromMetadata("")).toBe(DEFAULT_APP_THEME);
    expect(appThemeFromMetadata("neon")).toBe(DEFAULT_APP_THEME);
  });

  it("aceita todos os temas do app", () => {
    for (const t of APP_THEMES) {
      expect(appThemeFromMetadata(t.id)).toBe(t.id);
      expect(appThemeFromMetadata(` ${t.id.toUpperCase()} `)).toBe(t.id);
    }
  });
});
import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE_THEME, normalizeProfileTheme, PROFILE_THEMES } from "./profileTheme";

describe("normalizeProfileTheme", () => {
  it("defaults to dourado", () => {
    expect(normalizeProfileTheme(undefined)).toBe(DEFAULT_PROFILE_THEME);
    expect(normalizeProfileTheme("")).toBe(DEFAULT_PROFILE_THEME);
    expect(normalizeProfileTheme("invalid")).toBe(DEFAULT_PROFILE_THEME);
  });

  it("accepts known themes", () => {
    for (const t of PROFILE_THEMES) {
      expect(normalizeProfileTheme(t.id)).toBe(t.id);
      expect(normalizeProfileTheme(` ${t.id} `)).toBe(t.id);
    }
  });
});
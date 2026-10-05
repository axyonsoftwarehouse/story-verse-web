import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyStreakRescue, mergeBoughtFreezes, readingDays, readingSummary, streakRescue } from "./readingStats";

const STATS = "storyverse:reading-stats";
const META = "storyverse:streak-meta";

/** Quarta, 15/10/2026, meio-dia. */
const NOW = new Date(2026, 9, 15, 12);

function key(daysAgo: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Leu 5 minutos em cada um desses dias atrás. */
function readOn(...daysAgo: number[]) {
  localStorage.setItem(STATS, JSON.stringify(Object.fromEntries(daysAgo.map((n) => [key(n), 300]))));
}

function setShields(shields: number) {
  localStorage.setItem(META, JSON.stringify({ shields, frozen: [], awardedAt: 0 }));
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("streakRescue", () => {
  it("oferece salvar ontem com diamantes quando não há escudo", () => {
    readOn(2, 3, 4, 5, 6);
    const rescue = streakRescue();
    expect(rescue).toEqual({ days: [key(1)], shieldDays: [], paidDays: [key(1)], streak: 5 });
  });

  it("usa os escudos nos dias mais antigos e diamantes no resto", () => {
    readOn(3, 4, 5);
    setShields(1);
    const rescue = streakRescue();
    expect(rescue?.shieldDays).toEqual([key(2)]);
    expect(rescue?.paidDays).toEqual([key(1)]);
    expect(rescue?.streak).toBe(3);
  });

  it("não oferece nada se leu ontem, se não havia sequência ou se passou de 3 dias", () => {
    readOn(1, 2);
    expect(streakRescue()).toBeNull();

    localStorage.clear();
    readOn(5);
    expect(streakRescue()).toBeNull();

    localStorage.clear();
    expect(streakRescue()).toBeNull();
  });

  it("depois de aplicar, a sequência volta e o dia aparece como salvo com diamantes", () => {
    readOn(2, 3, 4);
    setShields(0);
    const rescue = streakRescue();
    expect(rescue).not.toBeNull();
    expect(readingSummary().streak).toBe(0);

    expect(applyStreakRescue(rescue!)).toBe(3);
    expect(readingSummary().streak).toBe(3);
    const yesterday = readingSummary().week[5];
    expect(yesterday).toMatchObject({ state: "frozen", bought: true });
    expect(readingDays(7)[5]).toMatchObject({ key: key(1), state: "frozen", bought: true });
    expect(streakRescue()).toBeNull();
  });

  it("gasta os escudos usados no salvamento", () => {
    readOn(3, 4);
    setShields(1);
    applyStreakRescue(streakRescue()!);
    const meta = JSON.parse(localStorage.getItem(META)!);
    expect(meta.shields).toBe(0);
    expect(meta.bought).toEqual([key(1)]);
    // O dia do escudo continua sendo "salvo por escudo".
    expect(readingDays(7)[4]).toMatchObject({ key: key(2), state: "frozen", bought: false });
  });
});

describe("mergeBoughtFreezes", () => {
  it("traz os dias salvos em outro aparelho uma vez só", () => {
    readOn(2, 3);
    expect(mergeBoughtFreezes([key(1)])).toBe(true);
    expect(mergeBoughtFreezes([key(1)])).toBe(false);
    expect(readingSummary().streak).toBe(2);
    expect(readingSummary().week[5].bought).toBe(true);
  });
});

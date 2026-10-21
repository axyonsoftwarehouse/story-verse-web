import { describe, expect, it } from "vitest";
import { achievements, takeNewAchievements, type AchievementInput } from "./achievements";

const base: AchievementInput = {
  totalMinutes: 0,
  bestStreak: 0,
  finishedBooks: 0,
  marks: 0,
  messagesSent: 0,
  charactersTalked: 0,
  giftsReceived: null,
};

const byId = (input: Partial<AchievementInput>) => new Map(achievements({ ...base, ...input }).map((a) => [a.id, a]));

describe("achievements", () => {
  it("conta nova: nada liberado e cada uma diz quanto falta", () => {
    const all = byId({});
    expect([...all.values()].every((a) => !a.unlocked)).toBe(true);
    expect(all.get("streak-7")?.missing).toBe("faltam 7 dias");
    expect(all.get("first-finish")?.missing).toBe("falta 1 livro");
  });

  it("libera ao chegar no alvo e não passa do alvo na barra", () => {
    const all = byId({ bestStreak: 9, messagesSent: 140 });
    expect(all.get("streak-7")).toMatchObject({ unlocked: true, current: 7, missing: "" });
    expect(all.get("chat-100")).toMatchObject({ unlocked: true, current: 100 });
    expect(all.get("streak-30")?.missing).toBe("faltam 21 dias");
  });

  it("tempo longo aparece em horas", () => {
    expect(byId({ totalMinutes: 30 }).get("hours-10")?.missing).toBe("faltam 10 horas");
    expect(byId({ totalMinutes: 540 }).get("hours-10")?.missing).toBe("faltam 60 minutos");
  });

  it("presentes ainda não carregados contam como zero", () => {
    expect(byId({ giftsReceived: null }).get("gift")?.unlocked).toBe(false);
    expect(byId({ giftsReceived: 2 }).get("gift")?.unlocked).toBe(true);
  });
});

describe("takeNewAchievements", () => {
  const memory = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  };

  it("na primeira vez guarda sem avisar; depois avisa só a nova, uma vez", () => {
    const store = memory();
    expect(takeNewAchievements(achievements({ ...base, totalMinutes: 5 }), store)).toEqual([]);
    const fresh = takeNewAchievements(achievements({ ...base, totalMinutes: 5, messagesSent: 1 }), store);
    expect(fresh.map((a) => a.id)).toEqual(["first-chat"]);
    expect(takeNewAchievements(achievements({ ...base, totalMinutes: 5, messagesSent: 1 }), store)).toEqual([]);
  });
});

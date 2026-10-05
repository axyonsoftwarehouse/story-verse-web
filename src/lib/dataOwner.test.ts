import { beforeEach, describe, expect, it } from "vitest";
import { activateDataOwner, currentDataOwner } from "./dataOwner";

const PREFS = "storyverse:reading-prefs";

beforeEach(() => {
  localStorage.clear();
});

describe("activateDataOwner", () => {
  it("adota os dados existentes na primeira conta, sem apagar nada", async () => {
    localStorage.setItem(PREFS, "antigo");
    expect(await activateDataOwner("userA")).toBe(false);
    expect(currentDataOwner()).toBe("userA");
    expect(localStorage.getItem(PREFS)).toBe("antigo");
  });

  it("não troca quando o dono é o mesmo", async () => {
    await activateDataOwner("userA");
    expect(await activateDataOwner("userA")).toBe(false);
  });

  it("guarda os dados da conta anterior no cofre e restaura os da nova", async () => {
    await activateDataOwner("userA");
    localStorage.setItem(PREFS, "dados de A");

    expect(await activateDataOwner("userB")).toBe(true);
    expect(currentDataOwner()).toBe("userB");
    expect(localStorage.getItem(PREFS)).toBeNull();

    expect(await activateDataOwner("userA")).toBe(true);
    expect(localStorage.getItem(PREFS)).toBe("dados de A");
  });
});

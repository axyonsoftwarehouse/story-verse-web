import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { activateDataOwner, currentDataOwner, storageForOwner, userStorage } from "./dataOwner";

const PREFS = "storyverse:reading-prefs";

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe("activateDataOwner", () => {
  it("adota os dados existentes na primeira conta, sem apagar nada", async () => {
    localStorage.setItem(PREFS, "antigo");
    await activateDataOwner("userA");
    expect(currentDataOwner()).toBe("userA");
    expect(userStorage.getItem(PREFS)).toBe("antigo");
  });

  it("não troca quando o dono é o mesmo", async () => {
    await activateDataOwner("userA");
    expect(await activateDataOwner("userA")).toBe(false);
  });

  it("guarda os dados da conta anterior no cofre e restaura os da nova", async () => {
    await activateDataOwner("userA");
    userStorage.setItem(PREFS, "dados de A");

    expect(await activateDataOwner("userB")).toBe(true);
    expect(currentDataOwner()).toBe("userB");
    expect(userStorage.getItem(PREFS)).toBeNull();

    expect(await activateDataOwner("userA")).toBe(true);
    expect(userStorage.getItem(PREFS)).toBe("dados de A");
  });
  it("another tab cannot redirect in-flight writes", async () => {
    await activateDataOwner("userA");
    localStorage.setItem("storyverse:data-owner", "userB");
    userStorage.setItem(PREFS, "A private");
    expect(currentDataOwner()).toBe("userA");
    expect(localStorage.getItem("storyverse:account:userB:" + PREFS)).toBeNull();
  });
  it("quota failures reject activation and preserve the previous owner", async () => {
    await activateDataOwner("userA");
    userStorage.setItem(PREFS, "private");
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key.startsWith("storyverse:account:userB:")) throw new DOMException("full", "QuotaExceededError");
      original.call(this, key, value);
    });
    await expect(activateDataOwner("userB")).rejects.toThrow();
    expect(currentDataOwner()).toBe("userA");
    expect(userStorage.getItem(PREFS)).toBe("private");
  });
  it("storageForOwner prende a escrita ao dono capturado, mesmo depois de trocar de conta", async () => {
    await activateDataOwner("userA");
    const captured = storageForOwner(currentDataOwner());
    await activateDataOwner("userB");
    captured.setItem(PREFS, "dados de A");
    expect(storageForOwner("userA").getItem(PREFS)).toBe("dados de A");
    expect(storageForOwner("userB").getItem(PREFS)).toBeNull();
  });
  it("não bloqueia a ativação se o cofre legado estiver corrompido", async () => {
    localStorage.setItem("storyverse:data-owner", "userA");
    localStorage.setItem("storyverse:vault:userA", "{not-json");
    await activateDataOwner("userA");
    expect(currentDataOwner()).toBe("userA");
  });
});

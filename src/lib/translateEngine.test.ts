import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** O detector guarda o resultado no módulo: cada teste importa uma cópia nova. */
async function freshDetect() {
  vi.resetModules();
  return (await import("./translate")).detectTranslationEngine;
}

function setTranslator(availability: () => Promise<string>) {
  (globalThis as { Translator?: unknown }).Translator = {
    availability,
    create: () => new Promise(() => {}),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as { Translator?: unknown }).Translator;
});

describe("detectTranslationEngine", () => {
  it("usa o tradutor do navegador quando ele responde", async () => {
    setTranslator(() => Promise.resolve("downloadable"));
    const detect = await freshDetect();
    await expect(detect()).resolves.toBe("local");
  });

  it("cai no Google quando o navegador não tem tradutor", async () => {
    const detect = await freshDetect();
    await expect(detect()).resolves.toBe("google");
  });

  it("cai no Google quando o tradutor do navegador nunca responde", async () => {
    setTranslator(() => new Promise(() => {}));
    const detect = await freshDetect();
    const result = detect();
    await vi.advanceTimersByTimeAsync(5000);
    await expect(result).resolves.toBe("google");
  });
});

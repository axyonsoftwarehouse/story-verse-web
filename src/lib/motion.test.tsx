import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { openBookWithTransition, prefersReducedMotion, useAnimatedNumber } from "./motion";

const originalMatchMedia = window.matchMedia;
const originalStart = (document as Document & { startViewTransition?: unknown }).startViewTransition;

function setReducedMotion(reduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: reduced && query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(performance.now()), 0),
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
});

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: originalMatchMedia,
  });
  if (originalStart) {
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      writable: true,
      value: originalStart,
    });
  } else {
    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
  }
  document.body.innerHTML = "";
  document.documentElement.classList.remove("vt-open-book");
});

describe("movimento", () => {
  it("respeita a preferência por menos movimento", () => {
    setReducedMotion(true);
    expect(prefersReducedMotion()).toBe(true);
    setReducedMotion(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("com movimento reduzido, pula a contagem", () => {
    setReducedMotion(true);
    const { result, rerender } = renderHook(({ value }) => useAnimatedNumber(value), {
      initialProps: { value: 10 },
    });
    expect(result.current).toBe(10);
    rerender({ value: 20 });
    expect(result.current).toBe(20);
  });

  it("conta a partir do valor anterior sem piscar o valor final", async () => {
    setReducedMotion(false);
    const { result, rerender } = renderHook(
      ({ value, from }: { value: number | null; from?: number }) =>
        useAnimatedNumber(value, { from, duration: 20 }),
      { initialProps: { value: null as number | null, from: undefined as number | undefined } },
    );
    expect(result.current).toBeNull();
    rerender({ value: 10, from: 5 });
    expect(result.current).toBe(5);
    await waitFor(() => expect(result.current).toBe(10), { timeout: 1500 });
  });

  it("abre direto quando o navegador não tem View Transitions", () => {
    setReducedMotion(false);
    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
    const update = vi.fn();
    openBookWithTransition(update);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("limpa o nome da capa e a classe ao terminar a transição", async () => {
    setReducedMotion(false);
    const cover = document.createElement("div");
    cover.className = "cover";
    Object.defineProperty(cover, "offsetWidth", { configurable: true, value: 120 });
    const child = document.createElement("span");
    cover.appendChild(child);
    document.body.appendChild(cover);
    child.dispatchEvent(new Event("pointerdown", { bubbles: true }));

    let callback: (() => void) | undefined;
    const start = vi.fn((update: () => void) => {
      callback = update;
      return { finished: Promise.resolve() };
    });
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      writable: true,
      value: start,
    });

    const update = vi.fn();
    openBookWithTransition(update);
    expect(start).toHaveBeenCalledTimes(1);
    expect(cover.style.getPropertyValue("view-transition-name")).toBe("sv-book");
    expect(document.documentElement.classList.contains("vt-open-book")).toBe(true);

    callback?.();
    expect(update).toHaveBeenCalledTimes(1);
    expect(cover.style.getPropertyValue("view-transition-name")).toBe("");
    await waitFor(() => expect(document.documentElement.classList.contains("vt-open-book")).toBe(false));
  });
});

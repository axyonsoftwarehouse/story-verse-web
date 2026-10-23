import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { Ebook } from "../../data/types";
import { markFinishPrompted } from "../../lib/libraryStore";
import { useFinishPrompt } from "./useFinishPrompt";

const dom = { id: "gb-55752", gutenbergId: 55752, title: "Dom Casmurro", author: "Machado de Assis", textLanguage: "pt" } as Ebook;

beforeEach(() => localStorage.clear());

describe("modal de conclusão depois da comemoração", () => {
  it("abre quando a comemoração some, de qualquer jeito que ela suma", () => {
    const { result, rerender } = renderHook(({ celebrating }) => useFinishPrompt(celebrating), {
      initialProps: { celebrating: true },
    });
    act(() => result.current.queue(dom));
    expect(result.current.open).toBeNull();
    rerender({ celebrating: false }); // ex.: o timer de 6,5 s fechou a comemoração
    expect(result.current.open?.id).toBe("gb-55752");
    act(() => result.current.close());
    expect(result.current.open).toBeNull();
  });

  it("não abre para livro que já teve o modal", () => {
    markFinishPrompted("gb:55752");
    const { result, rerender } = renderHook(({ celebrating }) => useFinishPrompt(celebrating), {
      initialProps: { celebrating: true },
    });
    act(() => result.current.queue(dom));
    rerender({ celebrating: false });
    expect(result.current.open).toBeNull();
  });
});

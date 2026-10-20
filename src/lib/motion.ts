import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

/**
 * Animações que dependem de JavaScript: a capa que vira o livro (View Transitions) e números
 * que sobem contando. Quem pediu menos movimento no aparelho vê tudo direto, sem animação.
 */

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

type ViewTransitionDoc = { startViewTransition?: (update: () => void) => { finished: Promise<void> } };

/** Último toque: de onde saiu o pedido para abrir o livro (cartão, botão "Ler"...). */
let lastPress: { el: Element; at: number } | null = null;
if (typeof window !== "undefined") {
  window.addEventListener(
    "pointerdown",
    (e) => {
      if (e.target instanceof Element) lastPress = { el: e.target, at: Date.now() };
    },
    true,
  );
}

/** A capa do cartão tocado agora há pouco, subindo alguns níveis a partir do toque. */
function pressedCover(): HTMLElement | null {
  if (!lastPress || Date.now() - lastPress.at > 1500) return null;
  let el: Element | null = lastPress.el;
  for (let i = 0; el && i < 5; i++, el = el.parentElement) {
    const cover = el.matches(".cover") ? el : el.querySelector(".cover");
    if (cover instanceof HTMLElement && cover.offsetWidth >= 40) return cover;
  }
  return null;
}

/**
 * Abre o livro com a capa crescendo até virar a tela de leitura. Sem suporte no navegador (ou
 * com movimento reduzido), só abre. `update` precisa trocar a tela de forma síncrona.
 */
export function openBookWithTransition(update: () => void) {
  const doc = document as unknown as ViewTransitionDoc;
  if (!doc.startViewTransition || prefersReducedMotion()) {
    update();
    return;
  }
  const cover = pressedCover();
  lastPress = null;
  // Só um elemento pode ter o nome por vez: a capa na foto "antes", o leitor na foto "depois".
  cover?.style.setProperty("view-transition-name", "sv-book");
  const root = document.documentElement;
  root.classList.add("vt-open-book");
  try {
    doc
      .startViewTransition(() => {
        cover?.style.removeProperty("view-transition-name");
        flushSync(update);
      })
      .finished.finally(() => root.classList.remove("vt-open-book"));
  } catch {
    cover?.style.removeProperty("view-transition-name");
    root.classList.remove("vt-open-book");
    update();
  }
}

/**
 * Número que sobe (ou desce) contando até `value`. Na primeira vez aparece direto, a não ser
 * que venha `from`: aí conta a partir dele (ex.: saldo antes do prêmio da roleta).
 */
export function useAnimatedNumber(value: number | null, opts: { from?: number; delay?: number; duration?: number } = {}): number | null {
  const [shown, setShown] = useState<number | null>(value);
  const shownRef = useRef<number | null>(value);
  const { from, delay = 0, duration = 900 } = opts;

  useEffect(() => {
    const set = (v: number | null) => {
      shownRef.current = v;
      setShown(v);
    };
    const start = shownRef.current ?? from ?? null;
    if (value === null || start === null || start === value || prefersReducedMotion()) {
      set(value);
      return;
    }
    set(start);
    let raf = 0;
    const timer = window.setTimeout(() => {
      const t0 = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        set(Math.round(start + (value - start) * eased));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
    // `from`, `delay` e `duration` só valem para a próxima mudança de valor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return shown;
}

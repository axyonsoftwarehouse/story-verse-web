import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DependencyList,
  type RefObject,
} from "react";
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
let lastPressTimer = 0;
if (typeof window !== "undefined") {
  window.addEventListener(
    "pointerdown",
    (e) => {
      if (!(e.target instanceof Element)) return;
      lastPress = { el: e.target, at: Date.now() };
      window.clearTimeout(lastPressTimer);
      lastPressTimer = window.setTimeout(() => {
        lastPress = null;
      }, 1500);
    },
    true,
  );
}

/** A capa do cartão tocado agora há pouco, subindo alguns níveis a partir do toque. */
function pressedCover(): HTMLElement | null {
  if (!lastPress || Date.now() - lastPress.at > 1500) {
    lastPress = null;
    return null;
  }
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
  window.clearTimeout(lastPressTimer);
  // Só um elemento pode ter o nome por vez: a capa na foto "antes", o leitor na foto "depois".
  cover?.style.setProperty("view-transition-name", "sv-book");
  const root = document.documentElement;
  root.classList.add("vt-open-book");
  const cleanup = () => {
    cover?.style.removeProperty("view-transition-name");
    root.classList.remove("vt-open-book");
  };
  try {
    doc
      .startViewTransition(() => {
        cover?.style.removeProperty("view-transition-name");
        flushSync(update);
      })
      .finished.finally(cleanup);
  } catch {
    cleanup();
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

  useLayoutEffect(() => {
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

/** Vibração curta no Android (iPhone não deixa). Só vibra depois que a pessoa já tocou na página. */
export function haptic(pattern: number | number[]) {
  if (prefersReducedMotion()) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Sem vibração: tudo bem.
  }
}

/**
 * Elementos de `root` que batem com `selector` ficam escondidos (`will-reveal`) e entram
 * quando aparecem na tela (`is-in`). Sem suporte ou com movimento reduzido, ficam visíveis.
 */
export function useReveal(rootRef: RefObject<HTMLElement | null>, selector: string, deps: DependencyList) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    root.querySelectorAll(selector).forEach((el) => {
      if (el.classList.contains("is-in")) return;
      el.classList.add("will-reveal");
      io.observe(el);
    });
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Capas dos cartões inclinam em 3D na direção do mouse (ou do dedo, enquanto pressiona), com um
 * reflexo de luz que acompanha. Um único ouvinte na página serve todas as capas.
 * Devolve a função que desliga.
 */
export function installCoverTilt(): () => void {
  if (typeof window === "undefined" || prefersReducedMotion()) return () => {};
  let current: HTMLElement | null = null;
  const reset = () => {
    if (!current) return;
    current.classList.remove("is-tilting");
    current = null;
  };
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  const move = (e: PointerEvent) => {
    // No toque só inclina enquanto o dedo está apertando (senão qualquer rolagem mexeria).
    if (e.pointerType === "touch" && e.buttons === 0) return reset();
    const host = e.target instanceof Element ? e.target.closest(".row-card, .result") : null;
    const cover = host?.querySelector<HTMLElement>(".cover") ?? null;
    if (cover !== current) reset();
    if (!cover) return;
    const r = cover.getBoundingClientRect();
    const x = clamp((e.clientX - r.left) / r.width);
    const y = clamp((e.clientY - r.top) / r.height);
    cover.style.setProperty("--rx", `${((0.5 - y) * 14).toFixed(2)}deg`);
    cover.style.setProperty("--ry", `${((x - 0.5) * 18).toFixed(2)}deg`);
    cover.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
    cover.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
    cover.classList.add("is-tilting");
    current = cover;
  };
  const end = (e: PointerEvent) => {
    if (e.pointerType === "touch") reset();
  };
  const out = (e: PointerEvent) => {
    if (!e.relatedTarget) reset(); // Saiu da janela.
  };
  document.addEventListener("pointermove", move, { passive: true });
  document.addEventListener("pointerdown", move, { passive: true });
  document.addEventListener("pointerup", end, { passive: true });
  document.addEventListener("pointercancel", reset, { passive: true });
  document.addEventListener("pointerout", out, { passive: true });
  return () => {
    reset();
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerdown", move);
    document.removeEventListener("pointerup", end);
    document.removeEventListener("pointercancel", reset);
    document.removeEventListener("pointerout", out);
  };
}

/**
 * Um emoji sai de `from` e voa em arco até `to`, que dá um pulinho ao receber (ex.: presente
 * chegando no avatar de quem ganhou). `from` pode ser a posição guardada de um botão que já
 * saiu da tela. Com movimento reduzido não anima; não segura nada da tela.
 */
export function flyEmoji(emoji: string, from: Element | DOMRect | null, to: Element | null) {
  if (!from || !to || prefersReducedMotion() || typeof document.body.animate !== "function") return;
  const a = from instanceof Element ? from.getBoundingClientRect() : from;
  const b = to.getBoundingClientRect();
  if (b.bottom < 0 || b.top > window.innerHeight) return;
  const x = a.left + a.width / 2;
  const y = a.top + a.height / 2;
  const dx = b.left + b.width / 2 - x;
  const dy = b.top + b.height / 2 - y;
  const el = document.createElement("span");
  el.className = "emoji-flight";
  el.textContent = emoji;
  el.setAttribute("aria-hidden", "true");
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);
  // Sobe um pouco acima da reta antes de descer no alvo.
  const lift = Math.min(-60, dy / 2 - 80);
  const flight = el.animate(
    [
      { transform: "translate(-50%, -50%) scale(0.6)", opacity: 0 },
      { transform: "translate(-50%, -50%) scale(1.4)", opacity: 1, offset: 0.15 },
      { transform: `translate(calc(-50% + ${dx / 2}px), calc(-50% + ${lift}px)) scale(1.2) rotate(-12deg)`, offset: 0.5 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.7) rotate(8deg)`, opacity: 1, offset: 0.92 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.3)`, opacity: 0 },
    ],
    { duration: 900, easing: "cubic-bezier(0.45, 0, 0.25, 1)" },
  );
  flight.onfinish = () => {
    el.remove();
    to.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.22) rotate(-6deg)" }, { transform: "scale(0.95)" }, { transform: "scale(1)" }],
      { duration: 480, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
    );
  };
  flight.oncancel = () => el.remove();
}

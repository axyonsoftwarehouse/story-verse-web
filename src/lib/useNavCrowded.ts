import { useLayoutEffect, useState } from "react";

export type NavFit = "full" | "crowded" | "tight";

const CLASSES = ["is-crowded", "is-tight"] as const;

export function useNavCrowded(): [(el: HTMLElement | null) => void, NavFit] {
  const [nav, setNav] = useState<HTMLElement | null>(null);
  
  // Função auxiliar pura para medir o ajuste sem depender do state
  const computeFit = (el: HTMLElement | null): NavFit => {
    if (!el) return "full";
    const actions = el.querySelector<HTMLElement>(".home-nav-actions");
    if (!actions) return "full";

    const had = CLASSES.filter((c) => el.classList.contains(c));
    const justify = actions.style.justifyContent;
    
    actions.style.justifyContent = "flex-start";
    el.classList.remove(...CLASSES);
    
    let next: NavFit = "full";
    const overflows = () => actions.scrollWidth > actions.clientWidth + 1;

    if (overflows()) {
      el.classList.add("is-crowded");
      next = overflows() ? "tight" : "crowded";
    }
    
    el.classList.remove(...CLASSES);
    el.classList.add(...had);
    actions.style.justifyContent = justify;
    
    return next;
  };

  // Inicializa o estado já avaliando a largura atual da janela/elemento para evitar o flash ("full" inicial)
  const [fit, setFit] = useState<NavFit>(() => {
    if (typeof window === "undefined") return "full";
    // Se a tela for menor que um limite seguro (ex: abaixo de 1024px, como os 1024x614 citados no QA), 
    // já nasce em "crowded" para evitar o flicker do estado cheio.
    return window.innerWidth < 1024 ? "crowded" : "full";
  });

  useLayoutEffect(() => {
    if (!nav) return;

    const measure = () => {
      const next = computeFit(nav);
      setFit(next);
    };

    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(nav);

    const actions = nav.querySelector<HTMLElement>(".home-nav-actions");
    let mutations: MutationObserver | null = null;
    if (actions) {
      mutations = new MutationObserver(measure);
      mutations.observe(actions, { childList: true, subtree: true, characterData: true });
    }

    let alive = true;
    void document.fonts?.ready.then(() => alive && measure());

    return () => {
      alive = false;
      resize.disconnect();
      mutations?.disconnect();
    };
  }, [nav]);

  return [setNav, fit];
}
import { useLayoutEffect, useState } from "react";

export type NavFit = "full" | "crowded" | "tight";

const CLASSES = ["is-crowded", "is-tight"] as const;

export function useNavCrowded(): [(el: HTMLElement | null) => void, NavFit] {
  const [nav, setNav] = useState<HTMLElement | null>(null);
  const [fit, setFit] = useState<NavFit>("crowded");

  useLayoutEffect(() => {
    const actions = nav?.querySelector<HTMLElement>(".home-nav-actions");
    if (!nav || !actions) {
      setFit("crowded");
      return;
    }

    const overflows = () => actions.scrollWidth > actions.clientWidth + 1;

    const measure = () => {
      const had = CLASSES.filter((c) => nav.classList.contains(c));
      const justify = actions.style.justifyContent;
      actions.style.justifyContent = "flex-start";
      nav.classList.remove(...CLASSES);
      let next: NavFit = "full";
      if (overflows()) {
        nav.classList.add("is-crowded");
        next = overflows() ? "tight" : "crowded";
      }
      nav.classList.remove(...CLASSES);
      nav.classList.add(...had);
      actions.style.justifyContent = justify;
      setFit(next);
    };

    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(nav);
    const mutations = new MutationObserver(measure);
    mutations.observe(actions, { childList: true, subtree: true, characterData: true });
    let alive = true;
    void document.fonts?.ready.then(() => alive && measure());
    return () => {
      alive = false;
      resize.disconnect();
      mutations.disconnect();
    };
  }, [nav]);

  return [setNav, fit];
}
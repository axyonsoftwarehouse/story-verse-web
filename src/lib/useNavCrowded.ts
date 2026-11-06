import { useLayoutEffect, useState } from "react";

/**
 * Quanto o topo precisa encolher para os botões caberem ao lado da marca:
 *  - "full": tudo cabe;
 *  - "crowded": os botões menos usados vão para o menu "Mais" (como nas telas estreitas);
 *  - "tight": nem assim cabe, e o selo "IA ativa" fica só com a bolinha (o texto continua
 *    para leitores de tela e no title). O selo nunca some: a equipe usa para saber se a IA está no ar.
 */
export type NavFit = "full" | "crowded" | "tight";

const CLASSES = ["is-crowded", "is-tight"] as const;

/**
 * O bloco de ações não quebra linha e fica alinhado à direita, então quando sobrava botão (conta de
 * admin, app não instalado...) ele transbordava para a esquerda e cobria "Storyverse".
 *
 * Cada nível é medido de verdade (aplica a classe e lê a largura, tudo no mesmo passo, sem pintar),
 * então o resultado não fica alternando entre os modos.
 * Devolve um ref de callback: o topo some no leitor e volta como outro elemento.
 */
export function useNavCrowded(): [(el: HTMLElement | null) => void, NavFit] {
  const [nav, setNav] = useState<HTMLElement | null>(null);
  const [fit, setFit] = useState<NavFit>("full");

  useLayoutEffect(() => {
    const actions = nav?.querySelector<HTMLElement>(".home-nav-actions");
    if (!nav || !actions) {
      setFit("full");
      return;
    }

    const overflows = () => actions.scrollWidth > actions.clientWidth + 1;

    const measure = () => {
      const had = CLASSES.filter((c) => nav.classList.contains(c));
      const justify = actions.style.justifyContent;
      // Alinhado à direita, o que transborda vai para a esquerda e não entra no scrollWidth.
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
    // Botões entram e saem depois do login, do carregamento das permissões etc.
    const mutations = new MutationObserver(measure);
    mutations.observe(actions, { childList: true, subtree: true, characterData: true });
    // A fonte dos botões chega depois e muda a largura deles sem mudar o tamanho do topo.
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

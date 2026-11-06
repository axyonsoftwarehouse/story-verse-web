import { useLayoutEffect, useState } from "react";

const CROWDED = "is-crowded";

/**
 * Diz se os botões do topo não cabem ao lado da marca. O bloco de ações não quebra linha e fica
 * alinhado à direita, então quando sobrava botão (conta de admin, app não instalado...) ele
 * transbordava para a esquerda e cobria "Storyverse". Com `true`, o CSS recolhe os botões menos
 * usados no menu "Mais", o mesmo das telas estreitas.
 *
 * A medida é sempre feita com a barra completa (tira a classe compacta e o alinhamento à direita
 * só durante a leitura, no mesmo passo, sem pintar), para não ficar alternando entre os dois modos.
 * Devolve um ref de callback: o topo some no leitor e volta como outro elemento.
 */
export function useNavCrowded(): [(el: HTMLElement | null) => void, boolean] {
  const [nav, setNav] = useState<HTMLElement | null>(null);
  const [crowded, setCrowded] = useState(false);

  useLayoutEffect(() => {
    const actions = nav?.querySelector<HTMLElement>(".home-nav-actions");
    if (!nav || !actions) {
      setCrowded(false);
      return;
    }

    const measure = () => {
      const wasCrowded = nav.classList.contains(CROWDED);
      nav.classList.remove(CROWDED);
      const justify = actions.style.justifyContent;
      // Alinhado à direita, o que transborda vai para a esquerda e não entra no scrollWidth.
      actions.style.justifyContent = "flex-start";
      const needed = actions.scrollWidth;
      const available = actions.clientWidth;
      actions.style.justifyContent = justify;
      if (wasCrowded) nav.classList.add(CROWDED);
      setCrowded(needed > available + 1);
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

  return [setNav, crowded];
}

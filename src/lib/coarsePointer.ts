/** Toque (celular): o menu da seleção vai abaixo do trecho, longe do menu nativo do sistema. */
export function coarsePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
}

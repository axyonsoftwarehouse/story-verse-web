/** Marcador de ilustração no texto de livros importados: "[[img:3]]" (a imagem fica no aparelho). */
export const IMAGE_MARKER = /^\[\[img:([\w-]+)\]\]$/;
const IMAGE_MARKERS = /\[\[img:[\w-]+\]\]/g;

/** Texto sem os marcadores de ilustração (para a IA, a voz e a tradução). */
export function withoutImageMarkers(text: string): string {
  return text.replace(IMAGE_MARKERS, "");
}

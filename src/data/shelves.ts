import type { Ebook } from "./types";

/** Estantes da vitrine de sugestões (Explorar e home). */
export const SHELVES: { id: NonNullable<Ebook["shelf"]>; title: string; subtitle: string }[] = [
  {
    id: "pt",
    title: "Em português",
    subtitle: "Romances e paixões proibidas, direto no nosso idioma.",
  },
  {
    id: "terror",
    title: "Terror e vampiros",
    subtitle: "Os clássicos do medo. Texto em inglês, conversa em português.",
  },
  {
    id: "classicos",
    title: "Mais clássicos",
    subtitle: "Mistério, romance e fantasia. Texto em inglês, conversa em português.",
  },
];

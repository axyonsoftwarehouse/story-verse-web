/**
 * Frase do dia na página inicial: trechos conhecidos dos livros em destaque (domínio público,
 * tradução livre quando o original é estrangeiro). O título precisa bater com o da estante.
 */
export const DAILY_QUOTES: { bookTitle: string; text: string }[] = [
  {
    bookTitle: "Orgulho e Preconceito",
    text: "É uma verdade universalmente reconhecida que um homem solteiro, possuidor de uma boa fortuna, deve estar necessitado de uma esposa.",
  },
  { bookTitle: "O Retrato de Dorian Gray", text: "A única maneira de se livrar de uma tentação é ceder a ela." },
  { bookTitle: "As Aventuras de Sherlock Holmes", text: "Você vê, mas não observa." },
  {
    bookTitle: "Alice no País das Maravilhas",
    text: "Comece pelo começo, disse o Rei, muito sério, e vá até chegar ao fim; então pare.",
  },
  { bookTitle: "Frankenstein", text: "Cuidado, pois eu não tenho medo, e por isso sou poderoso." },
  { bookTitle: "Drácula", text: "Bem-vindo à minha casa! Entre livremente e por sua própria vontade!" },
  { bookTitle: "O Fantasma da Ópera", text: "O Fantasma da Ópera existiu." },
  {
    bookTitle: "Iracema",
    text: "Iracema, a virgem dos lábios de mel, que tinha os cabelos mais negros que a asa da graúna.",
  },
  {
    bookTitle: "A Escrava Isaura",
    text: "No fértil e opulento município de Campos de Goitacases, à margem do Paraíba, havia uma linda e magnífica fazenda.",
  },
];

/** A mesma frase o dia todo, outra no dia seguinte. */
export function quoteOfTheDay(d = new Date()) {
  const day = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000);
  return DAILY_QUOTES[((day % DAILY_QUOTES.length) + DAILY_QUOTES.length) % DAILY_QUOTES.length];
}

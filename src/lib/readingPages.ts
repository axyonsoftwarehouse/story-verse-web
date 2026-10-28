import { userStorage } from "./dataOwner";
import { dayKey } from "./readingStats";

/**
 * Páginas lidas por dia, para as métricas do painel (docs/SPEC_ADMIN_DASHBOARD.md, item 2.2).
 *
 * Regra: **1 página = 250 palavras lidas**. Não depende do tamanho da tela nem da fonte.
 * - O leitor olha o que está na tela quando a rolagem para (1 s parada) e a cada 15 s de leitura
 *   ativa (aba visível). Quem passa correndo pelo capítulo não conta o que só passou voando.
 * - Conta o parágrafo que está pelo menos pela metade na tela, ou que ocupa metade da tela
 *   (parágrafo maior que a tela). Ilustrações não contam.
 * - Cada parágrafo (livro + capítulo + número do parágrafo) conta uma vez por dia: reler ou voltar
 *   a rolagem não soma de novo.
 * - Palavra = sequência de letras ou números separada por espaço.
 * - Páginas do dia = palavras do dia ÷ 250, arredondado para baixo.
 *
 * Fica no aparelho, por conta. O app envia o total do dia em report_reading e o banco guarda o
 * maior valor (dois aparelhos no mesmo dia não somam). O banco também limita o número ao tempo de
 * leitura que ele mesmo contou (ver V26__reading_days_pages.sql no story-verse-api).
 */
export const WORDS_PER_PAGE = 250;

const KEY = "storyverse:reading-pages";
/** Dias guardados: o que o app envia ao servidor (a semana do ranking e o fim da anterior). */
const KEEP_DAYS = 8;

type Day = { words: number; seen: string[] };
type Store = Record<string, Day>;

export type SeenBlock = { key: string; words: number };

export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

function read(): Store {
  try {
    const s = JSON.parse(userStorage.getItem(KEY) ?? "{}") as Store;
    return s && typeof s === "object" ? s : {};
  } catch {
    return {};
  }
}

/** Soma ao dia de hoje as palavras dos parágrafos ainda não contados hoje. Devolve as somadas. */
export function addSeenBlocks(blocks: SeenBlock[], now = new Date()): number {
  if (blocks.length === 0) return 0;
  const store = read();
  const today = dayKey(now);
  const day = store[today] ?? { words: 0, seen: [] };
  const seen = new Set(day.seen);
  let added = 0;
  for (const b of blocks) {
    if (seen.has(b.key) || b.words <= 0) continue;
    seen.add(b.key);
    added += b.words;
  }
  if (added === 0) return 0;
  store[today] = { words: day.words + added, seen: [...seen] };
  const days = Object.keys(store).sort();
  for (const old of days.slice(0, Math.max(0, days.length - KEEP_DAYS))) delete store[old];
  try {
    userStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Sem armazenamento.
  }
  return added;
}

/** Páginas lidas em cada um dos últimos `n` dias (só os que têm páginas). */
export function recentReadingPages(n: number, now = new Date()): Record<string, number> {
  const start = new Date(now);
  start.setDate(start.getDate() - (n - 1));
  const from = dayKey(start);
  const out: Record<string, number> = {};
  for (const [day, d] of Object.entries(read())) {
    const pages = Math.floor((d?.words ?? 0) / WORDS_PER_PAGE);
    if (day >= from && pages > 0) out[day] = pages;
  }
  return out;
}

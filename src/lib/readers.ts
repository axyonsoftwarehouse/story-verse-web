import type { Ebook } from "../data/types";
import type { SupabaseSession } from "./auth";
import { rpc } from "./rpc";

/**
 * Quantos leitores cada livro tem (database/book-readers.sql): o banco só devolve o total por
 * livro, nunca quem leu. Se a função ainda não existir no servidor, os cards ficam sem o número.
 */

/** O banco aceita no máximo 60 livros por pedido. */
const MAX_BOOKS = 60;

export async function fetchReaderCounts(session: SupabaseSession, books: Ebook[]): Promise<Record<string, number>> {
  const list = books.slice(0, MAX_BOOKS);
  if (list.length === 0) return {};
  const rows =
    (await rpc<{ book_id: string; readers: number }[]>(
      session,
      "book_reader_counts",
      { p_ids: list.map((b) => b.id), p_gids: list.map((b) => String(b.gutenbergId)) },
      { feature: "O contador de leitores" },
    )) ?? [];
  return Object.fromEntries(rows.map((r) => [r.book_id, r.readers]));
}

/** 950 → "950", 1234 → "1.2k", 15_400 → "15k", 2_300_000 → "2.3M". */
export function abbreviateCount(n: number): string {
  const value = Math.max(0, Math.floor(n));
  if (value < 1000) return String(value);
  const [div, unit] = value < 1_000_000 ? [1000, "k"] : [1_000_000, "M"];
  const scaled = value / div;
  // Uma casa decimal só abaixo de 10 (1.2k); acima disso o número inteiro já basta (15k).
  const text = scaled < 10 ? (Math.floor(scaled * 10) / 10).toString() : Math.floor(scaled).toString();
  return `${text}${unit}`;
}

export function readersLabel(n: number): string {
  return `${abbreviateCount(n)} ${n === 1 ? "leitor" : "leitores"}`;
}

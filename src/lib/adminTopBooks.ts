import type { SupabaseSession } from "./auth";
import { apiRequest } from "./backend";
import type { MetricsRange } from "./adminMetrics";

/**
 * Livros mais lidos (superadmin), pela estante: só livros do acervo, nunca `local:` nem resenhas.
 * Não há minutos por livro (`reading_days` não guarda o livro).
 */

export type AdminTopBook = {
  bookKey: string;
  title: string;
  author: string | null;
  /** Contas com o livro em leitura ou lido e atividade no período. */
  readers: number;
  /** Contas que terminaram o livro no período. */
  finished: number;
};

export function getTopBooks(
  session: SupabaseSession,
  range: MetricsRange,
  limit = 10,
): Promise<AdminTopBook[]> {
  const params = `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}&limit=${limit}`;
  return apiRequest<AdminTopBook[]>(`/api/v1/admin/metrics/top-books?${params}`, {
    accessToken: session.access_token,
  });
}

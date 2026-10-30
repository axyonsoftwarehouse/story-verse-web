import { featuredBooks } from "../../data/ebooks";
import { hasFeature } from "../../lib/accountFeatures";
import type { SupabaseSession } from "../../lib/auth";
import { GROUPS_AVAILABLE } from "../../lib/groups";
import { bookKeyOf } from "../../lib/library";
import { recentProgress } from "../../lib/progress";
import { useAccountFeatures } from "../auth/useAccountFeatures";

/**
 * Situação da conta diante dos grupos: sem API, sem conta ou sem a feature liberada. Devolve o
 * aviso para mostrar no lugar da tela, ou null quando pode usar.
 */
export function useGroupsGate(session: SupabaseSession | null, sessionLoading: boolean) {
  const { capabilities, loading } = useAccountFeatures(session);
  if (!GROUPS_AVAILABLE) return { ready: false, blocked: "Os grupos ainda não estão disponíveis neste ambiente." };
  if (sessionLoading || (session && loading)) return { ready: false, blocked: null };
  if (!session) return { ready: false, blocked: "Entre na sua conta para conversar nos grupos." };
  if (!hasFeature(capabilities, "groups")) {
    return { ready: false, blocked: "Os grupos estão em teste e ainda não foram liberados para a sua conta." };
  }
  return { ready: true, blocked: null };
}

export type BookOption = { key: string; title: string; cover?: string; chapter?: number };

/** Livros para escolher ao criar um clube: os que a pessoa começou e os do acervo em destaque. */
export function bookOptions(): BookOption[] {
  const seen = new Set<string>();
  const out: BookOption[] = [];
  const add = (key: string | null, title: string, cover?: string) => {
    if (!key || key.startsWith("local:") || seen.has(key)) return;
    seen.add(key);
    out.push({ key, title, cover: cover?.startsWith("https://") ? cover : undefined });
  };
  for (const p of recentProgress()) add(bookKeyOf(p.book), p.book.title, p.book.coverUrl);
  for (const b of featuredBooks) add(bookKeyOf(b), b.title, b.coverUrl);
  return out;
}

/** Capítulo em que o leitor está no livro (1, 2…), pelo progresso guardado; sem leitura, 0. */
export function myChapter(bookKey: string | null): number {
  if (!bookKey) return 0;
  const p = recentProgress().find((x) => bookKeyOf(x.book) === bookKey);
  return p ? p.chapterIndex + 1 : 0;
}

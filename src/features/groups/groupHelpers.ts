import type { CSSProperties } from "react";
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

/** Tom fixo (0–359) para cada grupo ou pessoa: a mesma cor sempre, sem guardar nada. */
export function hueOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

/** "Hoje", "Ontem" ou "12 de outubro" para separar a conversa por dia. */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const key = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  if (key(d) === key(now)) return "Hoje";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (key(d) === key(y)) return "Ontem";
  return d.toLocaleDateString("pt-BR", d.getFullYear() === now.getFullYear() ? { day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" });
}

/** Temas prontos de fundo da conversa (o mesmo conjunto que a API aceita). */
export const CHAT_BACKGROUNDS = [
  { id: "noite", label: "Noite" },
  { id: "biblioteca", label: "Biblioteca" },
  { id: "floresta", label: "Floresta" },
  { id: "oceano", label: "Oceano" },
  { id: "por-do-sol", label: "Pôr do sol" },
  { id: "papel", label: "Papel antigo" },
] as const;

/** Classe e estilo do fundo da conversa a partir do valor salvo no grupo. */
export function chatBackground(value: string | null | undefined): { className: string; style?: CSSProperties } {
  if (!value) return { className: "" };
  if (value.startsWith("preset:")) {
    const id = value.slice(7);
    return CHAT_BACKGROUNDS.some((b) => b.id === id) ? { className: `chat-bg-${id}` } : { className: "" };
  }
  return { className: "chat-bg-image", style: { "--chat-image": `url("${value.replace(/"/g, "%22")}")` } as CSSProperties };
}

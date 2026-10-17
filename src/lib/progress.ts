import { currentDataOwner, storageForOwner } from "./dataOwner";
import type { Ebook } from "../data/types";

const PROGRESS_KEY = "storyverse:reading-progress";
/** Guarda só os livros lidos mais recentemente (o localStorage é pequeno). */
const MAX_BOOKS = 30;

/** Onde o leitor parou em um livro. */
export type ReadingProgress = {
  /** O livro inteiro, para reabrir também os que vieram da busca no acervo. */
  book: Ebook;
  chapterIndex: number;
  chapterLabel: string;
  chapterCount: number;
  /** Rolagem dentro do capítulo, de 0 a 1. */
  scrollRatio: number;
  updatedAt: number;
};

type Store = Record<string, ReadingProgress>;

function readStore(owner: string | null = currentDataOwner()): Store {
  try {
    const raw = storageForOwner(owner).getItem(PROGRESS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store, owner: string | null = currentDataOwner()) {
  try {
    storageForOwner(owner).setItem(PROGRESS_KEY, JSON.stringify(store));
  } catch {
    // Sem armazenamento disponível: o progresso só não fica salvo.
  }
}

export function loadProgress(gutenbergId: number, owner: string | null = currentDataOwner()): ReadingProgress | null {
  const p = readStore(owner)[gutenbergId];
  if (!p || typeof p.chapterIndex !== "number" || typeof p.scrollRatio !== "number") return null;
  return p;
}

export function saveProgress(p: Omit<ReadingProgress, "updatedAt">, owner: string | null = currentDataOwner()) {
  const store = readStore(owner);
  store[p.book.gutenbergId] = { ...p, updatedAt: Date.now() };
  const keep = Object.entries(store)
    .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_BOOKS);
  writeStore(Object.fromEntries(keep), owner);
}

export function removeProgress(gutenbergId: number, owner: string | null = currentDataOwner()) {
  const store = readStore(owner);
  delete store[gutenbergId];
  writeStore(store, owner);
}

/** Desfaz a remoção: devolve o livro à lista com a mesma posição e a mesma data de leitura. */
export function restoreProgress(p: ReadingProgress, owner: string | null = currentDataOwner()) {
  const store = readStore(owner);
  store[p.book.gutenbergId] = p;
  writeStore(store, owner);
}

/** Livros começados, do lido mais recentemente para o mais antigo. */
export function recentProgress(owner: string | null = currentDataOwner()): ReadingProgress[] {
  return Object.values(readStore(owner))
    .filter((p) => p?.book && typeof p.chapterIndex === "number")
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Posição aproximada no livro inteiro, em %. */
export function progressPct(p: ReadingProgress): number {
  if (p.chapterCount <= 0) return 0;
  return Math.min(100, ((p.chapterIndex + p.scrollRatio) / p.chapterCount) * 100);
}

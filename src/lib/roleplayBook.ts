import type { Ebook } from "../data/types";
import { castFromNames } from "./cast";
import { apiBaseUrl } from "./backend";
import type { Group } from "./groups";
import { newLocalBookId, saveLocalBook } from "./localBooks";

/** Livro de um roleplay: a IA reescreve a história em capítulos (status e, quando pronto, o texto). */
export type RoleplayBook = {
  group_id: string;
  status: "writing" | "ready" | "failed";
  title: string;
  text: string | null;
  chapters: number;
  error: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Leva o livro do roleplay para a biblioteca da pessoa, como um livro importado: dá para ler e
 * conversar com os personagens da história (o elenco vem dos personagens do grupo).
 */
export async function addRoleplayBookToLibrary(book: RoleplayBook, group: Group): Promise<Ebook> {
  if (!book.text) throw new Error("O livro ainda não está pronto.");
  const characters = (group.members ?? [])
    .map((m) => m.rp_character?.trim())
    .filter((name): name is string => Boolean(name))
    .map((name) => `${name} — personagem do roleplay "${group.name}"`)
    .join("\n");
  const authors = (group.members ?? []).map((m) => m.name.split(" ")[0]).slice(0, 4);
  const id = newLocalBookId();
  const cover = group.photo_url && (group.photo_url.startsWith("https://") || group.photo_url.startsWith(`${apiBaseUrl}/`)) ? group.photo_url : undefined;
  const ebook: Ebook = {
    id: `local-${-id}`,
    gutenbergId: id,
    title: book.title,
    author: authors.length ? `${authors.join(", ")} e o Narrador` : "Roleplay do Storyverse",
    genre: "Roleplay",
    ...(cover ? { coverUrl: cover } : {}),
    textLanguage: "pt",
    source: "local",
    ...(characters ? { characters: castFromNames(book.title, characters) } : {}),
  };
  await saveLocalBook(ebook, book.text);
  return ebook;
}

import { CHARACTER_LINES } from "../data/characterLines";
import { featuredBooks } from "../data/ebooks";
import type { Ebook, StoryCharacter } from "../data/types";
import { userStorage } from "./dataOwner";
import type { ReadingProgress } from "./progress";
import { missYouMessage } from "./readingAmbient";
import { lastCharacter } from "./reminders";

/**
 * O personagem puxa conversa: quando o leitor some do livro, ele manda um recado na própria voz
 * (tela inicial e notificação); quando o leitor termina, se despede. Frases prontas, sem IA.
 */

/** Dias sem abrir o livro até o personagem mandar o recado. */
export const NUDGE_AFTER_DAYS = 2;

const DAY_MS = 86_400_000;
const DISMISSED_KEY = "storyverse:nudge-dismissed";
const FALLBACK_COLOR = "#c9a88c";

export type CharacterVoice = { id?: string; name: string; color: string };

export type HomeNudge = {
  progress: ReadingProgress;
  character: CharacterVoice;
  text: string;
  days: number;
};

const linesFor = (bookId: string, charId: string | undefined) =>
  charId ? CHARACTER_LINES[`${bookId}:${charId}`] : undefined;

/** Personagens escritos à mão do livro (a cópia guardada no progresso pode estar desatualizada). */
function curatedCast(book: Ebook): StoryCharacter[] {
  return featuredBooks.find((b) => b.id === book.id)?.characters ?? book.characters ?? [];
}

/**
 * Quem fala com o leitor: o último personagem com quem ele conversou neste livro; sem conversa,
 * o primeiro do elenco escrito à mão. Livro sem elenco à mão e sem conversa: ninguém.
 */
export function voiceFor(book: Ebook): CharacterVoice | undefined {
  const cast = curatedCast(book);
  const talked = lastCharacter(book.id);
  const picked = (talked ? cast.find((c) => c.name === talked) : undefined) ?? (talked ? undefined : cast[0]);
  if (picked) return { id: picked.id, name: picked.shortName ?? picked.name, color: picked.color };
  return talked ? { name: talked, color: FALLBACK_COLOR } : undefined;
}

/** O recado de saudade na voz do personagem; sem fala escrita para ele, a frase genérica. */
export function nudgeText(book: Ebook, voice: CharacterVoice, chapterLabel: string, days: number): string {
  return linesFor(book.id, voice.id)?.nudge ?? missYouMessage(chapterLabel, days);
}

/** Despedida ao terminar o livro, ou nada se não há personagem para falar. */
export function farewellFor(book: Ebook): { voice: CharacterVoice; text: string } | undefined {
  const voice = voiceFor(book);
  if (!voice) return undefined;
  const text =
    linesFor(book.id, voice.id)?.farewell ?? `Que jornada! Obrigado por ter lido “${book.title}” até o fim comigo.`;
  return { voice, text };
}

/** Cada recado é de uma "sumida": fechar vale até o leitor abrir o livro de novo. */
const dismissKey = (p: ReadingProgress) => `${p.book.id}:${p.updatedAt}`;

function isDismissed(p: ReadingProgress): boolean {
  try {
    return userStorage.getItem(DISMISSED_KEY) === dismissKey(p);
  } catch {
    return false;
  }
}

export function dismissNudge(p: ReadingProgress) {
  try {
    userStorage.setItem(DISMISSED_KEY, dismissKey(p));
  } catch {
    // Sem armazenamento: o recado volta na próxima visita.
  }
}

/**
 * Recado para a tela inicial: o livro lido por último, se o leitor está há pelo menos
 * NUDGE_AFTER_DAYS dias sem abri-lo e ainda não fechou este recado.
 */
export function homeNudge(recent: ReadingProgress[], now = Date.now()): HomeNudge | null {
  const progress = recent[0];
  if (!progress) return null;
  const days = Math.floor((now - progress.updatedAt) / DAY_MS);
  if (days < NUDGE_AFTER_DAYS || isDismissed(progress)) return null;
  const character = voiceFor(progress.book);
  if (!character) return null;
  return { progress, character, text: nudgeText(progress.book, character, progress.chapterLabel, days), days };
}

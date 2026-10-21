import { currentDataOwner, storageForOwner } from "./dataOwner";
import { naturalizeReply } from "./naturalSpeech";

/** Conversa com os personagens de cada livro, guardada no navegador para continuar depois. */

/** `reaction`: emoji que o personagem deixou na mensagem do leitor (carinho, risada…). */
export type ChatMsg = { id: string; role: "user" | "assistant"; text: string; reaction?: string };
type SavedChat = { threads: Record<string, ChatMsg[]>; activeCharId: string; updatedAt: number };

const KEY = (bookId: string) => `storyverse:chat:${bookId}`;
/** Mensagens guardadas por personagem (as mais recentes); a IA só recebe as últimas 10. */
const MAX_PER_CHARACTER = 80;
/** Conversas guardadas no total: as mais antigas saem quando passar disso. */
const MAX_BOOKS = 25;
const INDEX_KEY = "storyverse:chat-index";

export function loadChat(bookId: string, owner: string | null = currentDataOwner()): SavedChat | null {
  try {
    const raw = storageForOwner(owner).getItem(KEY(bookId));
    const saved = raw ? (JSON.parse(raw) as SavedChat) : null;
    if (!saved || typeof saved.threads !== "object") return null;
    // Conversas guardadas antes da limpeza de estilo (travessões, *ações*) aparecem já limpas.
    for (const msgs of Object.values(saved.threads)) {
      for (const m of msgs) if (m.role === "assistant") m.text = naturalizeReply(m.text);
    }
    return saved;
  } catch {
    return null;
  }
}

export function saveChat(
  bookId: string,
  threads: Record<string, ChatMsg[]>,
  activeCharId: string,
  owner: string | null = currentDataOwner(),
) {
  const trimmed = Object.fromEntries(
    Object.entries(threads).map(([id, msgs]) => [id, msgs.slice(-MAX_PER_CHARACTER)]),
  );
  try {
    const storage = storageForOwner(owner);
    storage.setItem(
      KEY(bookId),
      JSON.stringify({ threads: trimmed, activeCharId, updatedAt: Date.now() } satisfies SavedChat),
    );
    // Índice dos livros com conversa, para apagar as mais antigas.
    const index = (JSON.parse(storage.getItem(INDEX_KEY) ?? "[]") as string[]).filter((b) => b !== bookId);
    index.unshift(bookId);
    for (const old of index.splice(MAX_BOOKS)) storage.removeItem(KEY(old));
    storage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // Sem espaço: a conversa só não fica guardada.
  }
}

export function forgetChat(bookId: string, owner: string | null = currentDataOwner()) {
  try {
    storageForOwner(owner).removeItem(KEY(bookId));
  } catch {
    // Nada a limpar.
  }
}

/** Quantas mensagens você mandou para cada personagem, em todos os livros (para o perfil). */
export type CharacterTalk = { bookId: string; characterId: string; sent: number; lastAt: number };

export function characterTalks(owner: string | null = currentDataOwner()): CharacterTalk[] {
  let index: string[] = [];
  try {
    index = JSON.parse(storageForOwner(owner).getItem(INDEX_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
  const out: CharacterTalk[] = [];
  index.forEach((bookId, position) => {
    const saved = loadChat(bookId, owner);
    if (!saved) return;
    for (const [characterId, msgs] of Object.entries(saved.threads)) {
      const sent = msgs.filter((m) => m.role === "user").length;
      // O índice vem do mais recente para o mais antigo: serve de desempate.
      if (sent > 0) out.push({ bookId, characterId, sent, lastAt: (saved.updatedAt ?? 0) - position });
    }
  });
  return out.sort((a, b) => b.sent - a.sent || b.lastAt - a.lastAt);
}

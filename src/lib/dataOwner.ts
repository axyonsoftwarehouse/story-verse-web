/**
 * Dados de leitura por conta no mesmo aparelho. Progresso, marcações, conversas, sequência,
 * terminados e preferências ficam no localStorage; ao trocar de conta, os da conta anterior vão
 * para um cofre ("storyverse:vault:<id>") e os da nova voltam de lá. Os livros importados
 * (IndexedDB) guardam o dono em cada registro (ver localBooks.ts).
 *
 * Caches que não são pessoais (traduções, retratos, elenco sugerido pela IA) e o limite diário
 * de mensagens continuam do aparelho.
 */

const OWNER_KEY = "storyverse:data-owner";
/** Dono dos dados de antes desta separação (o primeiro a entrar depois da atualização). */
const LEGACY_OWNER_KEY = "storyverse:data-legacy-owner";
const VAULT_PREFIX = "storyverse:vault:";

const USER_KEYS = new Set([
  "storyverse:reading-progress",
  "storyverse:reading-stats",
  "storyverse:streak-meta",
  "storyverse:reading-goal",
  "storyverse:finished-books",
  "storyverse:last-character",
  "storyverse:reminder",
  "storyverse:reading-prefs",
  "storyverse:voice-prefs",
  "storyverse:chat-index",
]);
const USER_PREFIXES = ["storyverse:highlights:", "storyverse:chat:"];

export function isUserKey(key: string): boolean {
  return USER_KEYS.has(key) || USER_PREFIXES.some((p) => key.startsWith(p));
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Conta dona dos dados que estão em uso agora ("anon" = sem conta). */
export function currentDataOwner(): string | null {
  return safeGet(OWNER_KEY);
}

/** Dono dos livros importados sem dono gravado (de antes da separação). */
export function legacyDataOwner(): string | null {
  return safeGet(LEGACY_OWNER_KEY);
}

/**
 * Deixa em uso os dados de `owner` (id da conta ou "anon"). Devolve true se trocou — aí a tela
 * precisa ler tudo de novo.
 */
export function activateDataOwner(owner: string): boolean {
  try {
    const current = localStorage.getItem(OWNER_KEY);
    if (current === owner) return false;
    if (current === null) {
      // Primeira vez depois da atualização: os dados que já estavam aqui ficam com a primeira
      // conta que entrar. Sem conta ainda, não decide nada.
      if (owner === "anon") return false;
      localStorage.setItem(OWNER_KEY, owner);
      localStorage.setItem(LEGACY_OWNER_KEY, owner);
      return false;
    }

    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && isUserKey(k)) keys.push(k);
    }
    const snapshot: Record<string, string> = {};
    for (const k of keys) snapshot[k] = localStorage.getItem(k) ?? "";

    // Guarda os da conta anterior antes de apagar qualquer coisa.
    localStorage.setItem(VAULT_PREFIX + current, JSON.stringify(snapshot));
    for (const k of keys) localStorage.removeItem(k);

    const saved = localStorage.getItem(VAULT_PREFIX + owner);
    if (saved) {
      const data = JSON.parse(saved) as Record<string, string>;
      for (const [k, v] of Object.entries(data)) if (isUserKey(k)) localStorage.setItem(k, v);
      localStorage.removeItem(VAULT_PREFIX + owner);
    }
    localStorage.setItem(OWNER_KEY, owner);
    return true;
  } catch {
    // Sem espaço para o cofre: não troca nada (melhor que perder dados).
    return false;
  }
}

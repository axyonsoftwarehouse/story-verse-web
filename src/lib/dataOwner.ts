/**
 * Dados de leitura por conta no mesmo aparelho. Progresso, marcações, conversas, sequência,
 * terminados e preferências ficam em namespaces por conta no localStorage. Os cofres antigos
 * são migrados sem apagar a origem. A conta ativa pertence à aba. Os livros importados
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
  "storyverse:auto-freeze",
  "storyverse:spin-offered",
  "storyverse:reading-goal",
  "storyverse:finished-books",
  "storyverse:last-character",
  "storyverse:reminder",
  "storyverse:reading-prefs",
  "storyverse:voice-prefs",
  "storyverse:chat-index",
  "storyverse:library",
]);
const USER_PREFIXES = ["storyverse:highlights:", "storyverse:chat:"];

export function isUserKey(key: string): boolean {
  return USER_KEYS.has(key) || USER_PREFIXES.some((p) => key.startsWith(p));
}

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

// Active owner belongs to this tab. Another tab cannot redirect in-flight writes.
let tabOwner: string | null = safeGet(OWNER_KEY);
const ACCOUNT_PREFIX = "storyverse:account:";
const physicalKey = (key: string) => isUserKey(key) && tabOwner !== null ? ACCOUNT_PREFIX + tabOwner + ":" + key : key;

/** Personal keys are always stored in the namespace captured by this tab. */
export const userStorage = {
  getItem(key: string): string | null { return localStorage.getItem(physicalKey(key)); },
  setItem(key: string, value: string) { localStorage.setItem(physicalKey(key), value); },
  removeItem(key: string) { localStorage.removeItem(physicalKey(key)); },
  keys(): string[] {
    const prefix = tabOwner === null ? null : ACCOUNT_PREFIX + tabOwner + ":";
    const out: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (prefix && key.startsWith(prefix)) out.push(key.slice(prefix.length));
      else if (!key.startsWith(ACCOUNT_PREFIX) && (!prefix || !isUserKey(key))) out.push(key);
    }
    return out;
  },
  get length() { return this.keys().length; },
  key(index: number): string | null { return this.keys()[index] ?? null; },
};

export function currentDataOwner(): string | null { return tabOwner; }
export function legacyDataOwner(): string | null { return safeGet(LEGACY_OWNER_KEY); }

let pending: Promise<boolean> | null = null;
let pendingOwner: string | null = null;
function activate(owner: string): boolean {
  const previous = tabOwner;
  const marker = ACCOUNT_PREFIX + owner + ":migrated";
  // Migrate the old global/vault format once; leave the source intact until all writes succeed.
  if (localStorage.getItem(marker) === null) {
    const legacyOwner = localStorage.getItem(OWNER_KEY);
    const snapshot: Record<string, string> = {};
    const vault = localStorage.getItem(VAULT_PREFIX + owner);
    if (vault) Object.assign(snapshot, JSON.parse(vault));
    else if (legacyOwner === owner || legacyOwner === null && owner !== "anon") {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && isUserKey(key)) snapshot[key] = localStorage.getItem(key) ?? "";
      }
    }
    for (const [key, value] of Object.entries(snapshot)) {
      if (isUserKey(key) && typeof value === "string")
        localStorage.setItem(ACCOUNT_PREFIX + owner + ":" + key, value);
    }
    localStorage.setItem(marker, "1");
    if (legacyOwner === null && owner !== "anon") localStorage.setItem(LEGACY_OWNER_KEY, owner);
  }
  // Keep the original global-data owner stable until all legacy namespaces are migrated.
  if (localStorage.getItem(OWNER_KEY) === null && owner !== "anon") localStorage.setItem(OWNER_KEY, owner);
  tabOwner = owner;
  return previous !== owner;
}

export function activateDataOwner(owner: string): Promise<boolean> {
  if (pending && pendingOwner === owner) return pending;
  const run = () => {
    const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
    return locks?.request ? locks.request(OWNER_KEY, () => activate(owner)) : Promise.resolve().then(() => activate(owner));
  };
  const promise = pending ? pending.then(run, run) : run();
  pending = promise;
  pendingOwner = owner;
  const clear = () => { if (pending === promise) { pending = null; pendingOwner = null; } };
  void promise.then(clear, clear);
  return promise;
}

export function dataOwnerReady(): Promise<unknown> { return pending ?? Promise.resolve(); }

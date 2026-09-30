/**
 * Capa de reserva pela Open Library: para livro sem capa própria (ou cuja capa não carregou),
 * busca pelo título + autor e usa a capa da edição encontrada. O resultado fica guardado no
 * aparelho (também quando não acha nada, por uma semana) para não buscar de novo.
 */

const SEARCH_URL = "https://openlibrary.org/search.json";
// v2: a versão anterior guardava como "sem capa" falhas passageiras de carregamento.
const CACHE_KEY = "storyverse:ol-covers-v2";
const MISS_TTL = 7 * 86_400_000;
/** Buscas ao mesmo tempo (a Open Library é gratuita; não vale sobrecarregar). */
const MAX_PARALLEL = 2;

type CacheEntry = { url: string | null; at: number };

function readCache(): Record<string, CacheEntry> {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, CacheEntry>;
    return c && typeof c === "object" ? c : {};
  } catch {
    return {};
  }
}

function writeCache(key: string, entry: CacheEntry) {
  try {
    const c = readCache();
    c[key] = entry;
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    // Sem espaço: só não guarda (busca de novo na próxima vez).
  }
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mesmo livro? O título procurado aparece no encontrado (ou o contrário) — "O cortiço" ≈ "O Cortiço". */
function sameTitle(wanted: string, found: string): boolean {
  const a = normalize(wanted);
  const b = normalize(found);
  return a.length > 0 && (b === a || b.startsWith(a) || a.startsWith(b));
}

const coverUrl = (id: number) => `https://covers.openlibrary.org/b/id/${id}-M.jpg`;

type Doc = {
  title?: string;
  author_name?: string[];
  cover_i?: number;
  editions?: { docs?: { cover_i?: number; language?: string[] }[] };
};

async function search(title: string, author: string, lang: string): Promise<string | null> {
  const lastName = author.split(/\s+/).filter(Boolean).pop() ?? "";
  const params = new URLSearchParams({
    title,
    limit: "8",
    fields: "title,cover_i,editions,editions.cover_i,editions.language",
    lang: lang === "pt" ? "pt" : "en",
  });
  if (lastName && !/informado/i.test(author)) params.set("author", lastName);
  const res = await fetch(`${SEARCH_URL}?${params}`, {
    signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(10_000) : undefined,
  });
  if (!res.ok) throw new Error(`Open Library ${res.status}`);
  const { docs = [] } = (await res.json()) as { docs?: Doc[] };
  for (const d of docs) {
    if (!d.title || !sameTitle(title, d.title)) continue;
    // Livro em português: prefere a capa de uma edição em português, se houver.
    const ptEdition = lang === "pt" ? d.editions?.docs?.find((e) => e.cover_i && e.language?.includes("por")) : undefined;
    const id = ptEdition?.cover_i ?? d.cover_i ?? d.editions?.docs?.find((e) => e.cover_i)?.cover_i;
    if (id) return coverUrl(id);
  }
  // Tradução sem capa (ex.: "As Minas de Salomão"): busca livre por título + autor e aceita a
  // edição original do mesmo autor ("King Solomon's Mines", de Haggard).
  if (!lastName || /informado/i.test(author)) return null;
  const loose = new URLSearchParams({ q: `${title} ${lastName}`, limit: "5", fields: "title,author_name,cover_i", lang: params.get("lang") ?? "en" });
  const res2 = await fetch(`${SEARCH_URL}?${loose}`, {
    signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(10_000) : undefined,
  });
  if (!res2.ok) return null;
  const { docs: more = [] } = (await res2.json()) as { docs?: Doc[] };
  const wantedAuthor = normalize(lastName);
  const hit = more.find((d) => d.cover_i && d.author_name?.some((a) => normalize(a).split(" ").includes(wantedAuthor)));
  return hit?.cover_i ? coverUrl(hit.cover_i) : null;
}

// Fila simples: no máximo MAX_PARALLEL buscas de uma vez; o mesmo livro vira uma busca só.
const pending = new Map<string, Promise<string | null>>();
let running = 0;
const queue: (() => void)[] = [];

function runQueued<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      running++;
      task()
        .then(resolve, reject)
        .finally(() => {
          running--;
          queue.shift()?.();
        });
    };
    if (running < MAX_PARALLEL) start();
    else queue.push(start);
  });
}

/** Capa já conhecida (sem buscar): string = capa, null = não tem, undefined = ainda não buscou. */
export function knownCover(title: string, author: string): string | null | undefined {
  const entry = readCache()[normalize(`${title}|${author}`)];
  if (!entry) return undefined;
  if (!entry.url && Date.now() - entry.at > MISS_TTL) return undefined;
  return entry.url;
}

export function findOpenLibraryCover(title: string, author: string, lang: string): Promise<string | null> {
  const key = normalize(`${title}|${author}`);
  const known = knownCover(title, author);
  if (known !== undefined) return Promise.resolve(known);
  let p = pending.get(key);
  if (!p) {
    p = runQueued(() => search(title, author, lang))
      .then((url) => {
        writeCache(key, { url, at: Date.now() });
        return url;
      })
      // Sem internet ou Open Library fora: não guarda, tenta de novo outra hora.
      .catch((err: unknown) => {
        console.warn(`[capas] ${title}: ${err instanceof Error ? err.message : err}`);
        return null;
      })
      .finally(() => pending.delete(key));
    pending.set(key, p);
  }
  return p;
}

/** A capa encontrada falhou ao carregar: esquece para não insistir nela. */
export function forgetCover(title: string, author: string) {
  writeCache(normalize(`${title}|${author}`), { url: null, at: Date.now() });
}

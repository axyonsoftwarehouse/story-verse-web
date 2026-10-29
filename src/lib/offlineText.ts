import { AuthNetworkError } from "./backend";

/**
 * Cópia no aparelho do texto dos livros que vêm da API (biblioteca pública e comunidade), para
 * continuar lendo sem internet. Os do Gutenberg o service worker já guarda e os importados ficam
 * no IndexedDB; estes passavam só pela API e davam erro offline.
 *
 * Mesmo cache dos livros do Gutenberg no service worker (que limita a quantidade).
 */
const CACHE = "storyverse-books-v1";
/** Com cópia guardada, quanto esperar a rede antes de abrir a cópia (sinal fraco no ônibus). */
export const SLOW_NETWORK_MS = 8_000;

const keyUrl = (key: string) => `/__offline-text/${encodeURIComponent(key)}`;

async function openCache(): Promise<Cache | null> {
  try {
    return typeof caches === "undefined" ? null : await caches.open(CACHE);
  } catch {
    return null;
  }
}

export async function readOfflineText(key: string): Promise<string | null> {
  const cache = await openCache();
  const hit = await cache?.match(keyUrl(key)).catch(() => undefined);
  return hit ? hit.text() : null;
}

export async function saveOfflineText(key: string, text: string): Promise<void> {
  const cache = await openCache();
  await cache
    ?.put(keyUrl(key), new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } }))
    .catch(() => {});
}

/**
 * Baixa pela rede e guarda a cópia. Sem rede (ou com a rede pendurada por `SLOW_NETWORK_MS`),
 * abre a cópia guardada. Resposta do servidor (sem assinatura, livro removido) não usa a cópia:
 * só falha de conexão.
 */
export async function withOfflineCopy(key: string, load: () => Promise<string>): Promise<string> {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const copy = await readOfflineText(key);
  if (copy !== null && offline) return copy;

  const fromNetwork = load().then(async (text) => {
    await saveOfflineText(key, text);
    return text;
  });
  if (copy === null) return fromNetwork;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const slow = new Promise<string>((resolve) => {
    timer = setTimeout(() => resolve(copy), SLOW_NETWORK_MS);
  });
  try {
    return await Promise.race([
      fromNetwork.catch((error: unknown) => {
        if (error instanceof AuthNetworkError) return copy;
        throw error;
      }),
      slow,
    ]);
  } finally {
    clearTimeout(timer);
    // A rede pode terminar depois da cópia ter aberto: não deixa erro solto.
    fromNetwork.catch(() => {});
  }
}

import { fetchMediaFile } from "./groups";

/**
 * Fotos e áudios dos grupos no aparelho. O servidor guarda o arquivo só por 24 h; cada celular
 * que abre a mídia fica com a própria cópia (Cache Storage), que continua abrindo depois disso e
 * sem internet. Guarda as mais recentes (as antigas saem quando passa do limite).
 */

const CACHE = "storyverse-chat-media-v1";
const MAX_ITEMS = 400;
const urls = new Map<number, string>();
const loading = new Map<number, Promise<string | null>>();

const keyOf = (messageId: number) => `${location.origin}/__chat-media/${messageId}`;

async function openCache(): Promise<Cache | null> {
  try {
    return typeof caches === "undefined" ? null : await caches.open(CACHE);
  } catch {
    return null;
  }
}

async function trim(cache: Cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ITEMS))) await cache.delete(key);
}

/** Guarda no aparelho (a mídia que a própria pessoa enviou entra direto, sem baixar de volta). */
export async function keepMedia(messageId: number, blob: Blob): Promise<void> {
  urls.set(messageId, URL.createObjectURL(blob));
  const cache = await openCache();
  if (!cache) return;
  await cache.put(keyOf(messageId), new Response(blob, { headers: { "Content-Type": blob.type } })).catch(() => undefined);
  void trim(cache).catch(() => undefined);
}

/**
 * Endereço local da mídia: da memória, da cópia no aparelho ou baixada agora do servidor.
 * `null` quando não há cópia e o servidor não tem mais o arquivo.
 */
export function mediaUrl(messageId: number, available: boolean): Promise<string | null> {
  const known = urls.get(messageId);
  if (known) return Promise.resolve(known);
  const pending = loading.get(messageId);
  if (pending) return pending;
  const job = (async () => {
    const cache = await openCache();
    const hit = await cache?.match(keyOf(messageId)).catch(() => undefined);
    if (hit) {
      const url = URL.createObjectURL(await hit.blob());
      urls.set(messageId, url);
      return url;
    }
    if (!available) return null;
    const blob = await fetchMediaFile(messageId);
    if (!blob) return null;
    await keepMedia(messageId, blob);
    return urls.get(messageId) ?? null;
  })().finally(() => loading.delete(messageId));
  loading.set(messageId, job);
  return job;
}

/** Foto do celular reduzida para caber em 1280 px e comprimida (WebP; JPEG no Safari antigo). */
export async function prepareChatImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  if (!file.type.startsWith("image/")) throw new Error("Escolha uma imagem.");
  if (file.size > 30 * 1024 * 1024) throw new Error("Imagem grande demais.");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Não foi possível abrir esta imagem. Tente uma foto em JPG ou PNG.");
  });
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não conseguiu processar a imagem.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const toBlob = (type: string, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await toBlob("image/webp", 0.78);
  const blob = webp && webp.type === "image/webp" ? webp : await toBlob("image/jpeg", 0.8);
  if (!blob) throw new Error("Seu navegador não conseguiu processar a imagem.");
  return { blob, width, height };
}

/** Formato de gravação que o aparelho sabe fazer, preferindo o que toca em todos (MP4/AAC). */
export function recordingMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

/** "0:07", "1:30". */
export function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

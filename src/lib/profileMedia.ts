import { AuthNetworkError, supabaseConfig, type SupabaseSession } from "./auth";

/**
 * Foto de perfil e foto de capa no Storage do Supabase (bucket "profile-media", ver
 * supabase/profile-media.sql). A imagem é recortada e comprimida no aparelho antes de subir:
 * uma foto de 2–8 MB do celular vira ~20 KB (perfil) ou ~100 KB (capa).
 */

const BUCKET = "profile-media";

export type MediaKind = "avatar" | "cover";

const SIZES: Record<MediaKind, { width: number; height: number }> = {
  avatar: { width: 256, height: 256 },
  cover: { width: 1500, height: 500 },
};

/** Fotos maiores que isso nem são abertas (evita travar o celular). */
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível abrir esta imagem. Tente uma foto em JPG ou PNG."));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Recorta no centro (preenchendo o formato, como `object-fit: cover`) e comprime.
 * WebP quando o navegador sabe gerar; senão JPEG (Safari antigo devolve PNG para WebP).
 */
export async function prepareImage(file: File, kind: MediaKind): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  if (file.size > MAX_INPUT_BYTES) throw new Error("Imagem grande demais (máximo de 25 MB).");
  const img = await loadImage(file);
  const { width, height } = SIZES[kind];
  const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
  const w = Math.min(width, Math.round(img.naturalWidth * scale));
  const h = Math.min(height, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não conseguiu processar a imagem.");
  ctx.imageSmoothingQuality = "high";
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, w, h);
  const webp = await toBlob(canvas, "image/webp", 0.82);
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await toBlob(canvas, "image/jpeg", 0.85);
  if (!jpeg) throw new Error("Seu navegador não conseguiu processar a imagem.");
  return jpeg;
}

function friendly(message: string, status: number): string {
  const m = message.toLowerCase();
  if (m.includes("bucket not found")) return "As fotos de perfil ainda não foram configuradas no Supabase.";
  if (m.includes("row-level security") || status === 403) return "Sem permissão para enviar esta foto.";
  if (m.includes("exceeded the maximum") || status === 413) return "A imagem ficou grande demais para enviar.";
  if (m.includes("mime")) return "Formato de imagem não aceito. Use JPG, PNG ou WebP.";
  return message;
}

async function storage(path: string, init: { method: string; session: SupabaseSession; body?: Blob; headers?: Record<string, string> }) {
  const { url, anonKey } = supabaseConfig();
  let res: Response;
  try {
    res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
      method: init.method,
      headers: { apikey: anonKey, Authorization: `Bearer ${init.session.access_token}`, ...init.headers },
      body: init.body,
      signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(30_000) : undefined,
    });
  } catch {
    throw new AuthNetworkError("Sem conexão para enviar a foto. Tente de novo.");
  }
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    const message = payload.message ?? payload.error ?? `Erro ${res.status}`;
    console.warn(`[fotos] ${init.method} ${path} → ${res.status}: ${message}`);
    throw new Error(friendly(message, res.status));
  }
}

/**
 * Envia (substituindo a anterior no mesmo lugar) e devolve o endereço público. O `?v=` muda a
 * cada envio para o navegador não mostrar a foto antiga guardada em cache.
 */
export async function uploadProfileImage(session: SupabaseSession, kind: MediaKind, image: Blob): Promise<string> {
  const path = `${session.user.id}/${kind}`;
  await storage(path, {
    method: "POST",
    session,
    body: image,
    headers: { "Content-Type": image.type, "x-upsert": "true", "cache-control": "max-age=31536000" },
  });
  const { url } = supabaseConfig();
  return `${url}/storage/v1/object/public/${BUCKET}/${path}?v=${Date.now()}`;
}

export async function removeProfileImage(session: SupabaseSession, kind: MediaKind): Promise<void> {
  await storage(`${session.user.id}/${kind}`, { method: "DELETE", session }).catch((err: unknown) => {
    // Já não existia: tudo bem.
    if (err instanceof Error && /not found/i.test(err.message)) return;
    throw err;
  });
}

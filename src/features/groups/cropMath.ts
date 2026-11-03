/** Moldura de corte em pixels da imagem como aparece na tela. */
export type CropRect = { x: number; y: number; w: number; h: number };
export type Corner = "nw" | "ne" | "sw" | "se";

export const MIN_CROP = 48;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Arrasta a moldura inteira, sem sair da imagem. */
export function moveCrop(r: CropRect, dx: number, dy: number, bw: number, bh: number): CropRect {
  return { ...r, x: clamp(r.x + dx, 0, bw - r.w), y: clamp(r.y + dy, 0, bh - r.h) };
}

/**
 * Puxa um canto: o canto oposto fica parado. Com `ratio` (largura/altura), a proporção se
 * mantém. Nunca menor que {@link MIN_CROP} nem fora da imagem.
 */
export function resizeCrop(r: CropRect, corner: Corner, dx: number, dy: number, bw: number, bh: number, ratio: number | null): CropRect {
  const left = corner === "nw" || corner === "sw";
  const top = corner === "nw" || corner === "ne";
  // Canto oposto (fixo).
  const ax = left ? r.x + r.w : r.x;
  const ay = top ? r.y + r.h : r.y;
  // Espaço disponível até a borda da imagem a partir do canto fixo.
  const maxW = left ? ax : bw - ax;
  const maxH = top ? ay : bh - ay;
  let w = clamp(r.w + (left ? -dx : dx), MIN_CROP, maxW);
  let h = clamp(r.h + (top ? -dy : dy), MIN_CROP, maxH);
  if (ratio) {
    // Segue o lado que mais mudou e acerta o outro; se não couber, encolhe os dois.
    if (Math.abs(dx) >= Math.abs(dy)) h = w / ratio;
    else w = h * ratio;
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
    if (w > maxW) {
      w = maxW;
      h = w / ratio;
    }
  }
  return { x: left ? ax - w : ax, y: top ? ay - h : ay, w, h };
}

/** A maior moldura centralizada com a proporção pedida (ou a imagem inteira). */
export function initialCrop(bw: number, bh: number, ratio: number | null): CropRect {
  if (!ratio) return { x: 0, y: 0, w: bw, h: bh };
  let w = bw;
  let h = w / ratio;
  if (h > bh) {
    h = bh;
    w = h * ratio;
  }
  return { x: (bw - w) / 2, y: (bh - h) / 2, w, h };
}

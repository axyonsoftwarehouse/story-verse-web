/** Forma de onda dos áudios da conversa, tirada do próprio arquivo (nada novo no servidor). */

/** Barrinhas mais baixas que isso somem; o silêncio fica como um traço. */
const FLOOR = 0.12;

/** Reduz as amostras a `bars` alturas entre FLOOR e 1 (RMS por trecho, normalizado pelo maior). */
export function peaksFromSamples(samples: ArrayLike<number>, bars: number): number[] {
  const out = new Array<number>(bars).fill(FLOOR);
  if (samples.length === 0 || bars <= 0) return out;
  const size = samples.length / bars;
  const raw = out.map((_, i) => {
    const from = Math.floor(i * size);
    const to = Math.max(from + 1, Math.floor((i + 1) * size));
    let sum = 0;
    for (let j = from; j < to && j < samples.length; j++) sum += samples[j] * samples[j];
    return Math.sqrt(sum / (to - from));
  });
  const max = Math.max(...raw);
  if (!(max > 0)) return out;
  return raw.map((v) => Math.max(FLOOR, Math.min(1, v / max)));
}

/** Enquanto o arquivo não chega (ou se não der para ler): uma onda fixa por mensagem, sem pular. */
export function placeholderPeaks(seed: number, bars: number): number[] {
  let x = (Math.abs(Math.trunc(seed)) % 2147483646) + 1;
  return Array.from({ length: bars }, (_, i) => {
    x = (x * 16807) % 2147483647;
    const wave = 0.5 + 0.3 * Math.sin(i / 2.3);
    return Math.max(FLOOR, Math.min(1, wave * (0.45 + (x / 2147483647) * 0.55)));
  });
}

/** Ponto do áudio (0 a 1) onde o dedo/mouse está na barra. */
export function seekFraction(clientX: number, left: number, width: number): number {
  if (!(width > 0)) return 0;
  return Math.max(0, Math.min(1, (clientX - left) / width));
}

/** Velocidade: 1× → 1,5× → 2× → 1×. */
export function nextRate(rate: number): number {
  return rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
}

/** "1,5×". */
export function rateLabel(rate: number): string {
  return `${String(rate).replace(".", ",")}×`;
}

const RATE_KEY = "storyverse.audioRate";

/** A velocidade escolhida vale para os próximos áudios (só neste aparelho). */
export function savedRate(): number {
  try {
    const v = Number(localStorage.getItem(RATE_KEY));
    return v === 1.5 || v === 2 ? v : 1;
  } catch {
    return 1;
  }
}

export function saveRate(rate: number): void {
  try {
    localStorage.setItem(RATE_KEY, String(rate));
  } catch {
    /* modo privado: só não lembra */
  }
}

const cache = new Map<string, Promise<number[] | null>>();

/** Lê o áudio e devolve as alturas; guarda por endereço para não decodificar de novo ao rolar. */
export function audioPeaks(url: string, bars: number): Promise<number[] | null> {
  const key = `${bars}:${url}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = decode(url, bars).catch(() => null);
    cache.set(key, hit);
  }
  return hit;
}

async function decode(url: string, bars: number): Promise<number[] | null> {
  const Ctx: typeof AudioContext | undefined =
    typeof window === "undefined" ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctx) return null;
  const data = await (await fetch(url)).arrayBuffer();
  const ctx = new Ctx();
  try {
    const buffer = await ctx.decodeAudioData(data);
    return peaksFromSamples(buffer.getChannelData(0), bars);
  } finally {
    void ctx.close().catch(() => undefined);
  }
}

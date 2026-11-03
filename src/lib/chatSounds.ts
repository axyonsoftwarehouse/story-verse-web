/**
 * Sons da conversa, como no WhatsApp: um "pop" ao enviar e um "plim" ao receber com a conversa
 * aberta. Gerados na hora pelo Web Audio (nenhum arquivo para baixar). Dá para desligar.
 */

const KEY = "storyverse:chat-sounds";
let context: AudioContext | null = null;

export function chatSoundsOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setChatSounds(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Sem armazenamento: fica ligado nesta sessão.
  }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  // O navegador só libera o som depois de um toque: tenta retomar (sem toque, fica em silêncio).
  if (context.state === "suspended") void context.resume().catch(() => {});
  return context;
}

/** Um tom curto com subida e queda suaves (sem estalo). */
function tone(ctx: AudioContext, start: number, from: number, to: number, duration: number, volume: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** "Pop" de mensagem enviada. */
export function playSent() {
  if (!chatSoundsOn()) return;
  const ctx = audio();
  if (!ctx || ctx.state !== "running") return;
  tone(ctx, ctx.currentTime, 520, 980, 0.09, 0.12);
}

/** "Plim" de mensagem recebida (dois tons). */
export function playReceived() {
  if (!chatSoundsOn() || document.visibilityState !== "visible") return;
  const ctx = audio();
  if (!ctx || ctx.state !== "running") return;
  const now = ctx.currentTime;
  tone(ctx, now, 880, 900, 0.11, 0.1);
  tone(ctx, now + 0.1, 1320, 1340, 0.16, 0.08);
}

/** Libera o som no primeiro toque da pessoa (exigência dos navegadores, principalmente no iPhone). */
export function unlockChatSounds() {
  audio();
}

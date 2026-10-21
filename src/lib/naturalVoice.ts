/**
 * Voz natural (neural) que roda no próprio navegador: Piper, de código aberto, grátis e sem
 * chave. O modelo da voz (~60 MB) é baixado uma vez, do Hugging Face, e fica guardado no
 * aparelho; o motor vem de CDNs públicas. Soa bem mais humana que as vozes do Google no Chrome.
 *
 * A biblioteca só é carregada quando alguém usa ou baixa a voz: quem não usa não paga nada.
 */

const VOICE_IDS = { pt: "pt_BR-faber-medium", en: "en_US-lessac-medium" } as const;
const LABELS = { pt: "Voz natural (Faber)", en: "Voz natural (Lessac, inglês)" } as const;

/** Prefixo das vozes naturais na escolha de voz (as do aparelho usam o voiceURI do navegador). */
const PREFIX = "piper:";

export const naturalVoiceUri = (lang: "pt" | "en") => `${PREFIX}${VOICE_IDS[lang]}`;
export const naturalVoiceLabel = (lang: "pt" | "en") => LABELS[lang];
export const isNaturalVoiceUri = (uri: string | undefined): boolean => Boolean(uri?.startsWith(PREFIX));

type PiperModule = typeof import("@mintplex-labs/piper-tts-web");
let lib: Promise<PiperModule> | null = null;
const load = () => (lib ??= import("@mintplex-labs/piper-tts-web"));

/** Precisa de OPFS (armazenamento de arquivos do navegador) e WebAssembly. */
export function naturalVoiceSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.storage?.getDirectory === "function" &&
    typeof WebAssembly !== "undefined"
  );
}

/** Baixadas nesta visita: logo depois do download a biblioteca ainda pode não listar o arquivo. */
const justDownloaded = new Set<string>();

/** A voz já está baixada neste aparelho. */
export async function naturalVoiceReady(lang: "pt" | "en"): Promise<boolean> {
  if (!naturalVoiceSupported()) return false;
  if (justDownloaded.has(VOICE_IDS[lang])) return true;
  try {
    const tts = await load();
    return (await tts.stored()).includes(VOICE_IDS[lang]);
  } catch {
    return false;
  }
}

/** Baixa a voz (uma vez). `onProgress` recebe de 0 a 100. */
export async function downloadNaturalVoice(lang: "pt" | "en", onProgress: (pct: number) => void): Promise<void> {
  const tts = await load();
  await tts.download(VOICE_IDS[lang], (p) => {
    if (p.total > 0) onProgress(Math.min(100, Math.round((p.loaded / p.total) * 100)));
  });
  justDownloaded.add(VOICE_IDS[lang]);
}

const OFFER_KEY = "storyverse:natural-voice-offer";

/** A pessoa tocou em "Agora não": a oferta para de abrir sozinha ao tocar em "Ouvir". */
export function naturalOfferDismissed(): boolean {
  try {
    return localStorage.getItem(OFFER_KEY) === "0";
  } catch {
    return false;
  }
}

export function dismissNaturalOffer() {
  try {
    localStorage.setItem(OFFER_KEY, "0");
  } catch {
    // Sem armazenamento: a oferta pode aparecer de novo.
  }
}

/** Gera o áudio de um trecho (WAV). */
export async function synthesize(text: string, lang: "pt" | "en"): Promise<Blob> {
  const tts = await load();
  return tts.predict({ text, voiceId: VOICE_IDS[lang] });
}

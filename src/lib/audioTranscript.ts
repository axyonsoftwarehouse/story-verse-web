/**
 * Transcrição de áudio da conversa pela Web Speech API — **só no aparelho**.
 *
 * Regras que este módulo garante (cartão “transcrição e leitura de áudios”):
 * - nada de serviço de IA externo: se o navegador só souber transcrever na nuvem, a gente
 *   **recusa** e explica, em vez de mandar o áudio para o Google sem a pessoa saber;
 * - o áudio já gravado é transcrito tocando a faixa dentro de um `MediaStreamDestination`
 *   (`SpeechRecognition.start` aceita um `MediaStreamTrack` desde a revisão da API) — o som
 *   **não** sai na caixa de som porque a fonte é ligada só no destino do reconhecedor;
 * - o modelo de voz do aparelho pode ainda não estar baixado (`downloadable`): aí a tela pede
 *   o download, que é ação da própria pessoa (nunca baixa sozinho).
 */

export const TRANSCRIPT_LANG = "pt-BR";

export type LocalModel = "available" | "downloadable" | "downloading" | "unavailable" | "no-api";

type SpeechResult = ArrayLike<{ transcript: string }> & { isFinal: boolean };

type SpeechEvent = {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
};

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: (options?: unknown) => void;
  stop: () => void;
};

type RecognitionCtor = {
  new (): Recognition;
  available?: (options: { langs: string[]; processLocally?: boolean }) => Promise<string>;
  install?: (options: { langs: string[] }) => Promise<boolean>;
};

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function hasSpeechApi(): boolean {
  return recognitionCtor() !== null;
}

/** O navegador sabe transcrever? (sem dizer se é local) */
export function speechSupported(): boolean {
  return hasSpeechApi();
}

/** Estado do modelo **no aparelho**. Sem `available()`, não dá para garantir que seja local. */
export async function localModel(): Promise<LocalModel> {
  const Ctor = recognitionCtor();
  if (!Ctor) return "no-api";
  if (!Ctor.available) return "unavailable";
  try {
    const state = await Ctor.available({ langs: [TRANSCRIPT_LANG], processLocally: true });
    if (state === "available" || state === "downloadable" || state === "downloading") return state;
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

/** Baixa o modelo de voz do aparelho (uma vez). Só chamado a pedido da pessoa. */
export async function downloadModel(): Promise<boolean> {
  const Ctor = recognitionCtor();
  if (!Ctor?.install) return false;
  try {
    return await Ctor.install({ langs: [TRANSCRIPT_LANG] });
  } catch {
    return false;
  }
}

export class TranscriptError extends Error {
  constructor(
    readonly reason: "unsupported" | "needs-download" | "failed" | "empty",
    readonly detail?: string,
  ) {
    super(reason);
    this.name = "TranscriptError";
  }
}

/**
 * Transcreve o áudio do endereço dado (URL local/blob da mensagem).
 * Rejeita com `TranscriptError` explicando o motivo — a tela transforma cada motivo em uma frase.
 */
export async function transcribe(url: string, timeoutMs = 120_000): Promise<string> {
  const Ctor = recognitionCtor();
  if (!Ctor) throw new TranscriptError("unsupported");
  const model = await localModel();
  if (model === "downloadable" || model === "downloading") throw new TranscriptError("needs-download", model);
  if (model !== "available") throw new TranscriptError("unsupported", model);

  const audio = new Audio(url);
  audio.preload = "auto";
  const ctx = new AudioContext();
  const source = ctx.createMediaElementSource(audio);
  const sink = ctx.createMediaStreamDestination();
  // Só no destino do reconhecedor: a pessoa não ouve nada enquanto a transcrição acontece.
  source.connect(sink);
  const track = sink.stream.getAudioTracks()[0];
  if (!track) {
    void ctx.close();
    throw new TranscriptError("failed", "sem-faixa");
  }

  const recognition = new Ctor();
  recognition.lang = TRANSCRIPT_LANG;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.processLocally = true;

  let finalText = "";
  let failure: string | null = null;
  const finished = new Promise<void>((resolve) => {
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += `${result[0].transcript} `;
      }
    };
    recognition.onerror = (event) => {
      failure = event.error ?? "failed";
      resolve();
    };
    recognition.onend = () => resolve();
  });

  const stop = () => {
    try {
      recognition.stop();
    } catch {
      // já parou
    }
  };
  const timer = window.setTimeout(stop, timeoutMs);
  audio.onended = stop;

  try {
    startWithTrack(recognition, track);
  } catch (error) {
    window.clearTimeout(timer);
    audio.pause();
    void ctx.close();
    throw new TranscriptError("failed", error instanceof Error ? error.message : "start");
  }

  try {
    await audio.play();
  } catch {
    stop();
  }
  await finished;
  window.clearTimeout(timer);
  audio.pause();
  audio.removeAttribute("src");
  void ctx.close();

  const text = finalText.trim().replace(/\s+/g, " ");
  if (text) return text;
  if (failure === "language-not-supported") throw new TranscriptError("needs-download", failure);
  if (failure) throw new TranscriptError("failed", failure);
  throw new TranscriptError("empty");
}

/** Chromium aceita três formas de entregar a faixa; tenta a mais nova primeiro. */
function startWithTrack(recognition: Recognition, track: MediaStreamTrack): void {
  try {
    recognition.start({ audioTrack: track, processLocally: true });
    return;
  } catch {
    // forma antiga
  }
  try {
    recognition.start(track);
    return;
  } catch {
    // última tentativa
  }
  recognition.start();
}

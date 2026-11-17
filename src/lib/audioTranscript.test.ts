import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localModel, transcribe, TranscriptError } from "./audioTranscript";

type FakeEvent = { resultIndex: number; results: ArrayLike<unknown> };

/** Reconhecedor falso: no `start` entrega uma fala final e termina. */
class FakeRecognition {
  static availableState = "available";
  static installOk = true;
  static failWith: string | null = null;
  static lastOptions: unknown = null;

  lang = "";
  continuous = false;
  interimResults = false;
  processLocally = false;
  onresult: ((event: FakeEvent) => void) | null = null;
  onerror: ((event: { error?: string }) => void) | null = null;
  onend: (() => void) | null = null;

  static available(): Promise<string> {
    return Promise.resolve(FakeRecognition.availableState);
  }

  static install(): Promise<boolean> {
    return Promise.resolve(FakeRecognition.installOk);
  }

  start(options?: unknown): void {
    FakeRecognition.lastOptions = options ?? null;
    queueMicrotask(() => {
      if (FakeRecognition.failWith) {
        this.onerror?.({ error: FakeRecognition.failWith });
        return;
      }
      const result = Object.assign([{ transcript: "olá, mundo" }], { isFinal: true });
      this.onresult?.({ resultIndex: 0, results: [result] });
      this.onend?.();
    });
  }

  stop(): void {}
}

class FakeAudio {
  preload = "";
  onended: (() => void) | null = null;
  play(): Promise<void> {
    return Promise.resolve();
  }
  pause(): void {}
  removeAttribute(): void {}
}

class FakeContext {
  createMediaElementSource() {
    return { connect: () => undefined };
  }
  createMediaStreamDestination() {
    return { stream: { getAudioTracks: () => [{ kind: "audio" }] } };
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
}

const original = {
  recognition: (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition,
  audio: globalThis.Audio,
  context: globalThis.AudioContext,
};

beforeEach(() => {
  FakeRecognition.availableState = "available";
  FakeRecognition.installOk = true;
  FakeRecognition.failWith = null;
  FakeRecognition.lastOptions = null;
  (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = FakeRecognition;
  globalThis.Audio = FakeAudio as unknown as typeof Audio;
  globalThis.AudioContext = FakeContext as unknown as typeof AudioContext;
});

afterEach(() => {
  (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = original.recognition;
  globalThis.Audio = original.audio;
  globalThis.AudioContext = original.context;
  vi.restoreAllMocks();
});

describe("transcrição de áudio (Web Speech no aparelho)", () => {
  it("transcreve quando o modelo está no aparelho", async () => {
    await expect(transcribe("blob:audio")).resolves.toBe("olá, mundo");
    expect(await localModel()).toBe("available");
  });

  it("pede o download em vez de mandar o áudio para a nuvem", async () => {
    FakeRecognition.availableState = "downloadable";
    const erro = await transcribe("blob:audio").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(TranscriptError);
    expect((erro as TranscriptError).reason).toBe("needs-download");
  });

  it("sem a API de fala, recusa com motivo", async () => {
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = undefined;
    const erro = await transcribe("blob:audio").catch((e: unknown) => e);
    expect((erro as TranscriptError).reason).toBe("unsupported");
  });

  it("idioma não instalado no aparelho também pede download", async () => {
    FakeRecognition.failWith = "language-not-supported";
    const erro = await transcribe("blob:audio").catch((e: unknown) => e);
    expect((erro as TranscriptError).reason).toBe("needs-download");
  });
});

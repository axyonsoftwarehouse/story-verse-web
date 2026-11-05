import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const piper = vi.hoisted(() => {
  const create = vi.fn(async ({ voiceId }: { voiceId: string }) => ({
    voiceId,
    predict: async (text: string) => new Blob([`${voiceId}:${text}`]),
  }));
  class TtsSession {
    static _instance: unknown = { stale: true };
    static create = create;
  }
  return { PATH_MAP: {} as Record<string, string>, TtsSession, create };
});
vi.mock("@mintplex-labs/piper-tts-web", () => ({ PATH_MAP: piper.PATH_MAP, TtsSession: piper.TtsSession }));

import {
  downloadNaturalVoice,
  naturalVoiceFromUri,
  naturalVoiceLabel,
  naturalVoiceReady,
  naturalVoicesFor,
  naturalVoiceUri,
  storedNaturalVoices,
  synthesize,
} from "./naturalVoice";

/** OPFS em memória: só o que o módulo usa (pastas, arquivos, gravação com commit no close). */
class FakeDir {
  dirs = new Map<string, FakeDir>();
  files = new Map<string, Uint8Array>();
  async getDirectoryHandle(name: string, opts?: { create?: boolean }) {
    if (!this.dirs.has(name)) {
      if (!opts?.create) throw new DOMException("not found", "NotFoundError");
      this.dirs.set(name, new FakeDir());
    }
    return this.dirs.get(name)!;
  }
  async getFileHandle(name: string, opts?: { create?: boolean }) {
    if (!this.files.has(name) && !opts?.create) throw new DOMException("not found", "NotFoundError");
    return {
      getFile: async () => ({ size: this.files.get(name)?.length ?? 0 }),
      createWritable: async () => {
        const chunks: Uint8Array[] = [];
        return {
          write: async (c: Uint8Array | string) => void chunks.push(typeof c === "string" ? new TextEncoder().encode(c) : c),
          close: async () => {
            const all = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
            let p = 0;
            for (const c of chunks) {
              all.set(c, p);
              p += c.length;
            }
            this.files.set(name, all);
          },
          abort: async () => {},
        };
      },
    };
  }
}

let root: FakeDir;
const piperDir = () => root.dirs.get("piper");

function bytes(n: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(n);
}

function response(body: Uint8Array<ArrayBuffer>, init: { status?: number; length?: number } = {}) {
  return new Response(body, {
    status: init.status ?? 200,
    headers: { "Content-Length": String(init.length ?? body.length) },
  });
}

/** Config como vem do repositório oficial nas vozes novas: sem `speaker_id_map`. */
const NEW_CONFIG = { audio: { sample_rate: 22050 }, espeak: { voice: "pt-br" }, num_speakers: 1 };

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  root = new FakeDir();
  Object.defineProperty(navigator, "storage", {
    value: { getDirectory: async () => root },
    configurable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("catálogo de vozes naturais", () => {
  it("oferece Faber, Cadu e Jeff em português e Lessac em inglês", () => {
    expect(naturalVoicesFor("pt").map((v) => v.name)).toEqual(["Faber", "Cadu", "Jeff"]);
    expect(naturalVoicesFor("en").map((v) => v.name)).toEqual(["Lessac"]);
  });

  it("lê a escolha salva, inclusive a antiga da Faber", () => {
    expect(naturalVoiceFromUri("piper:pt_BR-faber-medium")?.name).toBe("Faber");
    expect(naturalVoiceFromUri(naturalVoiceUri("pt_BR-cadu-medium"))?.name).toBe("Cadu");
    expect(naturalVoiceFromUri("piper:voz-que-nao-existe")).toBeUndefined();
    expect(naturalVoiceFromUri("Google português do Brasil")).toBeUndefined();
  });

  it("dá nomes para a lista de vozes", () => {
    expect(naturalVoiceLabel("pt_BR-jeff-medium")).toBe("Voz natural (Jeff)");
    expect(naturalVoiceLabel("en_US-lessac-medium")).toBe("Voz natural (Lessac, inglês)");
  });
});

describe("vozes baixadas", () => {
  it("só conta a voz com o modelo inteiro e o config", async () => {
    const dir = await root.getDirectoryHandle("piper", { create: true });
    dir.files.set("pt_BR-faber-medium.onnx", bytes(2_000_000));
    dir.files.set("pt_BR-faber-medium.onnx.json", bytes(10));
    // Jeff sem config, Cadu com modelo quebrado (resposta de erro gravada como arquivo).
    dir.files.set("pt_BR-jeff-medium.onnx", bytes(2_000_000));
    dir.files.set("pt_BR-cadu-medium.onnx", bytes(15));
    dir.files.set("pt_BR-cadu-medium.onnx.json", bytes(10));

    expect(await storedNaturalVoices("pt")).toEqual(["pt_BR-faber-medium"]);
    expect(await naturalVoiceReady("pt_BR-faber-medium")).toBe(true);
    expect(await naturalVoiceReady("pt_BR-cadu-medium")).toBe(false);
    expect(await storedNaturalVoices("en")).toEqual([]);
  });
});

describe("download", () => {
  it("baixa do repositório oficial numa versão fixa, com o nome que a biblioteca procura", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith(".json") ? jsonResponse(NEW_CONFIG) : response(bytes(1_500_000)),
    );
    vi.stubGlobal("fetch", fetchMock);
    const progress: number[] = [];

    await downloadNaturalVoice("pt_BR-cadu-medium", (pct) => progress.push(pct));

    const urls = fetchMock.mock.calls.map(([u]) => u);
    expect(urls).toHaveLength(2);
    for (const u of urls) {
      expect(u).toMatch(/^https:\/\/huggingface\.co\/rhasspy\/piper-voices\/resolve\/[0-9a-f]{40}\/pt\/pt_BR\/cadu\/medium\//);
    }
    expect(piperDir()?.files.get("pt_BR-cadu-medium.onnx")?.length).toBe(1_500_000);
    expect(progress.at(-1)).toBe(100);
    expect(await storedNaturalVoices("pt")).toEqual(["pt_BR-cadu-medium"]);
  });

  it("completa o config das vozes novas com o speaker_id_map que a biblioteca exige", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (url.endsWith(".json") ? jsonResponse(NEW_CONFIG) : response(bytes(1_500_000)))),
    );
    await downloadNaturalVoice("pt_BR-cadu-medium", () => {});
    const saved = JSON.parse(new TextDecoder().decode(piperDir()?.files.get("pt_BR-cadu-medium.onnx.json")));
    expect(saved).toMatchObject({ espeak: { voice: "pt-br" }, speaker_id_map: {} });
  });

  it("recusa config que não é de uma voz", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "Entry not found" })));
    await expect(downloadNaturalVoice("pt_BR-cadu-medium", () => {})).rejects.toThrow(/inválido/);
    expect(await naturalVoiceReady("pt_BR-cadu-medium")).toBe(false);
  });

  it("não grava resposta de erro como se fosse a voz", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(bytes(15), { status: 404 })));
    await expect(downloadNaturalVoice("pt_BR-jeff-medium", () => {})).rejects.toThrow(/404/);
    expect(await naturalVoiceReady("pt_BR-jeff-medium")).toBe(false);
  });

  it("descarta download incompleto", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith(".json") ? jsonResponse(NEW_CONFIG) : response(bytes(1_200_000), { length: 60_000_000 }),
      ),
    );
    await expect(downloadNaturalVoice("pt_BR-jeff-medium", () => {})).rejects.toThrow(/incompleto/);
    expect(piperDir()?.files.has("pt_BR-jeff-medium.onnx")).toBe(false);
  });
});

describe("síntese", () => {
  it("recria a sessão do Piper ao trocar de voz e reaproveita na mesma voz", async () => {
    expect(await (await synthesize("oi", "pt_BR-faber-medium")).text()).toBe("pt_BR-faber-medium:oi");
    expect(await (await synthesize("de novo", "pt_BR-faber-medium")).text()).toBe("pt_BR-faber-medium:de novo");
    expect(piper.create).toHaveBeenCalledTimes(1);

    expect(await (await synthesize("oi", "pt_BR-cadu-medium")).text()).toBe("pt_BR-cadu-medium:oi");
    expect(piper.create).toHaveBeenCalledTimes(2);
    // A sessão antiga (com o modelo da voz anterior) é descartada antes de criar a nova.
    expect(piper.TtsSession._instance).toBeNull();
    // Cadu e Jeff passam a ser conhecidas pela biblioteca, que lê o arquivo guardado pelo nome.
    expect(piper.PATH_MAP["pt_BR-cadu-medium"]).toMatch(/pt_BR-cadu-medium\.onnx$/);
    expect(piper.PATH_MAP["pt_BR-jeff-medium"]).toMatch(/pt_BR-jeff-medium\.onnx$/);
  });
});

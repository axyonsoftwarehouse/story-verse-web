/**
 * Voz natural (neural) que roda no próprio navegador: Piper, de código aberto, grátis e sem
 * chave. Cada voz (~60 MB) é baixada uma vez, do Hugging Face, e fica guardada no aparelho; o
 * motor vem de CDNs públicas. Soa bem mais humana que as vozes do Google no Chrome.
 *
 * O download é nosso, do repositório oficial (rhasspy) numa versão fixa: o espelho que a
 * biblioteca usa não tem Cadu nem Jeff. Os arquivos vão para a mesma pasta do OPFS ("piper") e
 * com o mesmo nome que a biblioteca procura, então ela lê a voz do aparelho sem baixar de novo.
 *
 * A biblioteca só é carregada quando alguém usa a voz: quem não usa não paga nada.
 */

export type NaturalLang = "pt" | "en";

export type NaturalVoice = {
  /** Id do Piper ("pt_BR-faber-medium"). */
  id: string;
  lang: NaturalLang;
  /** Nome curto para a tela. */
  name: string;
  /** Caminho no repositório de vozes, sem a extensão. */
  path: string;
};

/** Na ordem em que aparecem; a primeira de cada idioma é a sugerida. */
export const NATURAL_VOICES: readonly NaturalVoice[] = [
  { id: "pt_BR-faber-medium", lang: "pt", name: "Faber", path: "pt/pt_BR/faber/medium/pt_BR-faber-medium" },
  { id: "pt_BR-cadu-medium", lang: "pt", name: "Cadu", path: "pt/pt_BR/cadu/medium/pt_BR-cadu-medium" },
  { id: "pt_BR-jeff-medium", lang: "pt", name: "Jeff", path: "pt/pt_BR/jeff/medium/pt_BR-jeff-medium" },
  { id: "en_US-lessac-medium", lang: "en", name: "Lessac", path: "en/en_US/lessac/medium/en_US-lessac-medium" },
];

/** Repositório oficial numa versão fixa: o arquivo baixado é sempre o mesmo modelo. */
const VOICES_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/e7229f7d33a10e145e109b886d661984201ac3c4";
/** Pasta do OPFS em que a biblioteca procura as vozes. */
const OPFS_DIR = "piper";
/** Um modelo de verdade tem dezenas de MB; menos que isso é download quebrado. */
const MIN_MODEL_BYTES = 1_000_000;

/** Prefixo das vozes naturais na escolha de voz (as do aparelho usam o voiceURI do navegador). */
const PREFIX = "piper:";

export const naturalVoicesFor = (lang: NaturalLang) => NATURAL_VOICES.filter((v) => v.lang === lang);
export const naturalVoiceUri = (id: string) => `${PREFIX}${id}`;
export const isNaturalVoiceUri = (uri: string | undefined): boolean => Boolean(uri?.startsWith(PREFIX));

/** Voz natural de uma escolha salva, ou `undefined` se não for uma voz natural conhecida. */
export function naturalVoiceFromUri(uri: string | undefined): NaturalVoice | undefined {
  if (!isNaturalVoiceUri(uri)) return undefined;
  const id = uri!.slice(PREFIX.length);
  return NATURAL_VOICES.find((v) => v.id === id);
}

export function naturalVoiceLabel(id: string): string {
  const voice = NATURAL_VOICES.find((v) => v.id === id);
  if (!voice) return "Voz natural";
  return voice.lang === "en" ? `Voz natural (${voice.name}, inglês)` : `Voz natural (${voice.name})`;
}

const fileName = (voice: NaturalVoice, ext: ".onnx" | ".onnx.json") => `${voice.path.split("/").at(-1)}${ext}`;

type PiperModule = typeof import("@mintplex-labs/piper-tts-web");
let lib: Promise<PiperModule> | null = null;
const load = () =>
  (lib ??= import("@mintplex-labs/piper-tts-web").then((m) => {
    // A biblioteca só lê do aparelho as vozes que conhece; o caminho só precisa terminar no nome do arquivo.
    const paths = m.PATH_MAP as Record<string, string>;
    for (const v of NATURAL_VOICES) paths[v.id] ??= `${v.path}.onnx`;
    return m;
  }));

/** Precisa de OPFS (armazenamento de arquivos do navegador) e WebAssembly. */
export function naturalVoiceSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.storage?.getDirectory === "function" &&
    typeof WebAssembly !== "undefined"
  );
}

async function voicesDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(OPFS_DIR, { create: true });
}

async function fileSize(dir: FileSystemDirectoryHandle, name: string): Promise<number> {
  try {
    return (await (await dir.getFileHandle(name)).getFile()).size;
  } catch {
    return 0;
  }
}

async function isStored(dir: FileSystemDirectoryHandle, voice: NaturalVoice): Promise<boolean> {
  const [model, config] = await Promise.all([
    fileSize(dir, fileName(voice, ".onnx")),
    fileSize(dir, fileName(voice, ".onnx.json")),
  ]);
  return model >= MIN_MODEL_BYTES && config > 0;
}

/** Ids das vozes naturais do idioma já baixadas neste aparelho, na ordem do catálogo. */
export async function storedNaturalVoices(lang: NaturalLang): Promise<string[]> {
  if (!naturalVoiceSupported()) return [];
  try {
    const dir = await voicesDir();
    const voices = naturalVoicesFor(lang);
    const stored = await Promise.all(voices.map((v) => isStored(dir, v)));
    return voices.filter((_, i) => stored[i]).map((v) => v.id);
  } catch {
    return [];
  }
}

/** A voz já está baixada neste aparelho. */
export async function naturalVoiceReady(id: string): Promise<boolean> {
  const voice = NATURAL_VOICES.find((v) => v.id === id);
  if (!voice || !naturalVoiceSupported()) return false;
  try {
    return await isStored(await voicesDir(), voice);
  } catch {
    return false;
  }
}

/** Baixa um arquivo direto para o OPFS; só fica gravado se o download terminar inteiro. */
async function downloadFile(
  dir: FileSystemDirectoryHandle,
  url: string,
  name: string,
  onBytes?: (loaded: number, total: number) => void,
): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Download da voz falhou (${res.status}): ${name}`);
  const total = Number(res.headers.get("Content-Length") ?? 0);
  const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
  const reader = res.body.getReader();
  let loaded = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      await writable.write(value);
      loaded += value.length;
      onBytes?.(loaded, total);
    }
    // Só "a menos" é erro: com compressão, os bytes já descomprimidos passam do Content-Length.
    if (total > 0 && loaded < total) throw new Error(`Download da voz incompleto: ${name}`);
    await writable.close();
  } catch (e) {
    await writable.abort().catch(() => {});
    throw e;
  }
}

/**
 * Baixa o config da voz e grava no formato que a biblioteca lê. As vozes mais novas (Cadu, Jeff)
 * vêm sem `speaker_id_map`, que a biblioteca exige; com um locutor só, ele é vazio.
 */
async function downloadConfig(dir: FileSystemDirectoryHandle, voice: NaturalVoice): Promise<void> {
  const name = fileName(voice, ".onnx.json");
  const res = await fetch(`${VOICES_BASE}/${voice.path}.onnx.json`);
  if (!res.ok) throw new Error(`Download da voz falhou (${res.status}): ${name}`);
  const config = (await res.json()) as { espeak?: { voice?: string }; speaker_id_map?: Record<string, number> };
  if (!config.espeak?.voice) throw new Error(`Config de voz inválido: ${name}`);
  config.speaker_id_map ??= {};
  const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
  try {
    await writable.write(JSON.stringify(config));
    await writable.close();
  } catch (e) {
    await writable.abort().catch(() => {});
    throw e;
  }
}

/** Baixa a voz (uma vez). `onProgress` recebe de 0 a 100. */
export async function downloadNaturalVoice(id: string, onProgress: (pct: number) => void): Promise<void> {
  const voice = NATURAL_VOICES.find((v) => v.id === id);
  if (!voice) throw new Error(`Voz natural desconhecida: ${id}`);
  const dir = await voicesDir();
  // O config primeiro: a voz só conta como baixada quando o modelo (o arquivo grande) termina.
  await downloadConfig(dir, voice);
  await downloadFile(dir, `${VOICES_BASE}/${voice.path}.onnx`, fileName(voice, ".onnx"), (loaded, total) => {
    if (total > 0) onProgress(Math.min(100, Math.round((loaded / total) * 100)));
  });
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

type Session = InstanceType<PiperModule["TtsSession"]>;
let session: { id: string; ready: Promise<Session> } | null = null;

/**
 * Sessão do Piper com o modelo desta voz. A biblioteca guarda uma sessão só e, ao pedir outra
 * voz, troca o nome mas continua com o modelo carregado antes; por isso, ao mudar de voz, a
 * sessão é descartada e recriada.
 */
async function sessionFor(id: string): Promise<Session> {
  if (session?.id !== id) {
    const previous = session?.ready;
    const ready = (async () => {
      await previous?.catch(() => {});
      const { TtsSession } = await load();
      TtsSession._instance = null;
      return TtsSession.create({ voiceId: id as never });
    })();
    session = { id, ready };
    ready.catch(() => {
      if (session?.ready === ready) session = null;
    });
  }
  return session.ready;
}

/** Gera o áudio de um trecho (WAV) com a voz escolhida. */
export async function synthesize(text: string, id: string): Promise<Blob> {
  return (await sessionFor(id)).predict(text);
}

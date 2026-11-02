import type { SupabaseSession } from "./auth";
import { apiRequest } from "./backend";
import type { CatalogRights } from "./adminCatalog";

/**
 * Cadastro de audiolivros no admin. O áudio fica em edição separada do livro
 * (`catalog_book_audio`) e cada capítulo aponta para um arquivo no R2.
 */

export type AudioEditionStatus = "draft" | "processing" | "published" | "hidden" | "failed";
export type AudioSource = "librivox" | "admin" | "partner";
export type AudioChapterStatus = "processing" | "ready" | "failed";
export type AudioTextMapping = "pending" | "mapped" | "none";

export type AdminAudioChapter = {
  id: string;
  audio_id: string;
  chapter_index: number;
  title: string | null;
  audio_path: string;
  duration_seconds: number;
  start_seconds: number;
  end_seconds: number | null;
  size_bytes: number | null;
  status: AudioChapterStatus;
  text_chapter_index: number | null;
  text_chapter_end_index: number | null;
};

export type AdminAudioEdition = {
  id: string;
  book_id: string;
  language: "pt" | "en";
  narrator: string | null;
  source: AudioSource;
  source_url: string | null;
  rights: CatalogRights;
  rights_note: string | null;
  license_note: string | null;
  text_mapping: AudioTextMapping;
  total_duration_seconds: number;
  chapter_count: number;
  cover_url: string | null;
  status: AudioEditionStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  chapters: AdminAudioChapter[];
};

export type AudioEditionInput = {
  language: "pt" | "en";
  narrator?: string;
  source: AudioSource;
  sourceUrl?: string;
  rights: CatalogRights;
  rightsNote?: string;
  licenseNote?: string;
  textMapping?: AudioTextMapping;
};

export type AudioChapterInput = {
  path: string;
  chapterIndex: number;
  title: string;
  durationSeconds: number;
  startSeconds?: number;
  endSeconds?: number | null;
  sizeBytes?: number | null;
};

export type AudioChapterPatch = {
  title?: string;
  textChapterIndex?: number | null;
  textChapterEndIndex?: number | null;
  startSeconds?: number;
  endSeconds?: number | null;
};

export type AudioUploadTarget = {
  uploadUrl: string;
  path: string;
};

export const MAX_AUDIO_BYTES = 1024 * 1024 * 1024;
export const AUDIO_ACCEPT =
  ".mp3,.m4a,.m4b,.aac,.ogg,.opus,.wav,audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/wav";

const AUDIO_KINDS: Record<string, { contentType: string; extension: string }> = {
  ".mp3": { contentType: "audio/mpeg", extension: ".mp3" },
  ".m4a": { contentType: "audio/mp4", extension: ".m4a" },
  ".m4b": { contentType: "audio/mp4", extension: ".m4b" },
  ".aac": { contentType: "audio/aac", extension: ".aac" },
  ".ogg": { contentType: "audio/ogg", extension: ".ogg" },
  ".opus": { contentType: "audio/ogg", extension: ".opus" },
  ".wav": { contentType: "audio/wav", extension: ".wav" },
};

const MIME_KINDS: Record<string, { contentType: string; extension: string }> = {
  "audio/mpeg": { contentType: "audio/mpeg", extension: ".mp3" },
  "audio/mp4": { contentType: "audio/mp4", extension: ".m4a" },
  "audio/x-m4a": { contentType: "audio/mp4", extension: ".m4a" },
  "audio/aac": { contentType: "audio/aac", extension: ".aac" },
  "audio/ogg": { contentType: "audio/ogg", extension: ".ogg" },
  "audio/opus": { contentType: "audio/ogg", extension: ".opus" },
  "audio/wav": { contentType: "audio/wav", extension: ".wav" },
  "audio/x-wav": { contentType: "audio/wav", extension: ".wav" },
};

const EDITION_STATUS_LABELS: Record<AudioEditionStatus, string> = {
  draft: "Rascunho",
  processing: "Processando",
  published: "Publicado",
  hidden: "Oculto",
  failed: "Falhou",
};

const SOURCE_LABELS: Record<AudioSource, string> = {
  librivox: "LibriVox",
  admin: "Enviado pelo admin",
  partner: "Parceiro",
};

export function audioEditionStatusLabel(status: AudioEditionStatus): string {
  return EDITION_STATUS_LABELS[status] ?? status;
}

export function audioEditionStatusTone(status: AudioEditionStatus): string {
  if (status === "published") return "is-approved";
  if (status === "draft" || status === "processing") return "is-pending";
  if (status === "failed") return "is-rejected";
  return "is-hidden";
}

export function audioSourceLabel(source: AudioSource): string {
  return SOURCE_LABELS[source] ?? source;
}

/** Formato de arquivo de áudio aceito no upload (pelo nome; o servidor confere de novo). */
export function audioFileKind(file: File): { contentType: string; extension: string } {
  const name = file.name.toLowerCase();
  const extension = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  const byName = AUDIO_KINDS[extension];
  if (byName) return byName;
  const byType = MIME_KINDS[file.type.toLowerCase()];
  if (byType) return byType;
  throw new Error("Formato de áudio não aceito. Envie MP3, M4A, M4B, AAC, OGG, OPUS ou WAV.");
}

export function checkAudioFile(file: File): { contentType: string; extension: string } {
  if (file.size === 0) throw new Error("O arquivo de áudio está vazio.");
  if (file.size > MAX_AUDIO_BYTES) {
    throw new Error("Arquivo de áudio grande demais (máximo de 1 GB).");
  }
  return audioFileKind(file);
}

/** Duração lida no próprio navegador, antes de subir o arquivo. */
export function probeAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    if (typeof Audio === "undefined") {
      reject(new Error("Este navegador não consegue ler a duração do áudio."));
      return;
    }
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    let settled = false;
    let timeout = 0;
    const finish = (duration?: number, error?: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
      if (error) reject(new Error(error));
      else resolve(duration ?? 0);
    };
    timeout = window.setTimeout(
      () => finish(undefined, "Não foi possível ler a duração do áudio. O arquivo pode estar corrompido."),
      20_000,
    );
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0;
      if (duration <= 0) {
        finish(undefined, "O áudio não informou uma duração válida.");
        return;
      }
      finish(duration);
    };
    audio.onerror = () => finish(undefined, "Não foi possível abrir o áudio para ler a duração.");
    audio.src = url;
    audio.load();
  });
}

export function chapterTitleFromFile(fileName: string): string {
  const title = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return title || "Capítulo";
}

export function formatAudioDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min`;
  return `${total} s`;
}

/** Relógio curto para a tabela: 1:02:03 ou 12:34. */
export function formatAudioClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

/** Aceita "1:02:03", "12:34" ou "125". Devolve segundos ou null. */
export function parseAudioClock(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const parts = text.split(":");
  if (parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) return null;
  const numbers = parts.map(Number);
  if (numbers.some((number) => !Number.isFinite(number))) return null;
  if (numbers.length === 1) return numbers[0];
  if (numbers.length === 2) {
    const [minutes, seconds] = numbers;
    if (seconds >= 60) return null;
    return minutes * 60 + seconds;
  }
  const [hours, minutes, seconds] = numbers;
  if (minutes >= 60 || seconds >= 60) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

function normalizeEdition(edition: AdminAudioEdition): AdminAudioEdition {
  return { ...edition, chapters: Array.isArray(edition.chapters) ? edition.chapters : [] };
}

export async function listAudioEditions(
  session: SupabaseSession,
  bookId: string,
): Promise<AdminAudioEdition[]> {
  const result = await apiRequest<AdminAudioEdition[] | { editions?: AdminAudioEdition[] }>(
    `/api/v1/admin/catalog/books/${encodeURIComponent(bookId)}/audio`,
    { accessToken: session.access_token },
  );
  const list = Array.isArray(result) ? result : (result.editions ?? []);
  return list.map(normalizeEdition);
}

export async function createAudioEdition(
  session: SupabaseSession,
  bookId: string,
  input: AudioEditionInput,
): Promise<AdminAudioEdition> {
  const body: Record<string, unknown> = {
    language: input.language,
    source: input.source,
    rights: input.rights,
    textMapping: input.textMapping ?? "pending",
  };
  if (input.narrator?.trim()) body.narrator = input.narrator.trim();
  if (input.sourceUrl?.trim()) body.sourceUrl = input.sourceUrl.trim();
  if (input.rightsNote?.trim()) body.rightsNote = input.rightsNote.trim();
  if (input.licenseNote?.trim()) body.licenseNote = input.licenseNote.trim();
  const edition = await apiRequest<AdminAudioEdition>(
    `/api/v1/admin/catalog/books/${encodeURIComponent(bookId)}/audio`,
    { method: "POST", accessToken: session.access_token, body },
  );
  return normalizeEdition(edition);
}

export async function updateAudioEdition(
  session: SupabaseSession,
  audioId: string,
  input: AudioEditionInput,
): Promise<AdminAudioEdition> {
  const edition = await apiRequest<AdminAudioEdition>(
    `/api/v1/admin/catalog/audio/${encodeURIComponent(audioId)}`,
    {
      method: "PATCH",
      accessToken: session.access_token,
      body: {
        language: input.language,
        narrator: input.narrator?.trim() || null,
        source: input.source,
        sourceUrl: input.sourceUrl?.trim() || null,
        rights: input.rights,
        rightsNote: input.rightsNote?.trim() || null,
        licenseNote: input.licenseNote?.trim() || null,
        ...(input.textMapping ? { textMapping: input.textMapping } : {}),
      },
    },
  );
  return normalizeEdition(edition);
}

export function setAudioEditionStatus(
  session: SupabaseSession,
  audioId: string,
  action: "publish" | "hide",
): Promise<AdminAudioEdition> {
  return apiRequest<AdminAudioEdition>(
    `/api/v1/admin/catalog/audio/${encodeURIComponent(audioId)}/${action}`,
    { method: "POST", accessToken: session.access_token },
  );
}

export function deleteAudioEdition(session: SupabaseSession, audioId: string): Promise<void> {
  return apiRequest<void>(`/api/v1/admin/catalog/audio/${encodeURIComponent(audioId)}`, {
    method: "DELETE",
    accessToken: session.access_token,
  });
}

/** Pede ao backend uma URL assinada para o admin enviar o arquivo direto ao R2. */
export function requestAudioUpload(
  session: SupabaseSession,
  audioId: string,
  fileName: string,
  contentType: string,
  sizeBytes: number,
): Promise<AudioUploadTarget> {
  return apiRequest<AudioUploadTarget>(
    `/api/v1/admin/catalog/audio/${encodeURIComponent(audioId)}/upload-url`,
    {
      method: "POST",
      accessToken: session.access_token,
      body: { fileName, contentType, sizeBytes },
    },
  );
}

export async function uploadAudioFile(
  uploadUrl: string,
  file: File,
  contentType: string,
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Não foi possível enviar o áudio (${response.status}).`);
  }
}

export async function registerAudioChapter(
  session: SupabaseSession,
  audioId: string,
  input: AudioChapterInput,
): Promise<AdminAudioChapter> {
  return apiRequest<AdminAudioChapter>(
    `/api/v1/admin/catalog/audio/${encodeURIComponent(audioId)}/chapters`,
    {
      method: "POST",
      accessToken: session.access_token,
      body: {
        path: input.path,
        chapterIndex: input.chapterIndex,
        title: input.title,
        durationSeconds: input.durationSeconds,
        startSeconds: input.startSeconds ?? 0,
        endSeconds: input.endSeconds ?? null,
        sizeBytes: input.sizeBytes ?? null,
      },
    },
  );
}

export function updateAudioChapter(
  session: SupabaseSession,
  audioId: string,
  chapterIndex: number,
  patch: AudioChapterPatch,
): Promise<AdminAudioChapter> {
  return apiRequest<AdminAudioChapter>(
    `/api/v1/admin/catalog/audio/${encodeURIComponent(audioId)}/chapters/${chapterIndex}`,
    {
      method: "PATCH",
      accessToken: session.access_token,
      body: patch,
    },
  );
}

import type { SupabaseSession } from "./auth";
import { apiRequest } from "./backend";

export type AudioBookListItem = {
  bookKey: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  narrator: string | null;
  language: string;
  totalDurationSeconds: number;
  chapterCount: number;
  rights: string;
  licenseNote: string | null;
  publishedAt: string | null;
};

export type AudioChapter = {
  index: number;
  title: string | null;
  durationSeconds: number;
  startSeconds: number;
  endSeconds: number | null;
  textChapterIndex: number | null;
  textChapterEndIndex: number | null;
  free: boolean;
};

export type AudioEdition = {
  id: string;
  language: string;
  narrator: string | null;
  source: string;
  sourceUrl: string | null;
  rights: string;
  licenseNote: string | null;
  totalDurationSeconds: number;
  chapterCount: number;
  coverUrl: string | null;
  /** Capítulo aberto sem conta; null quando a edição não tem amostra (S4). */
  freeChapterIndex: number | null;
  requiresSubscription: boolean;
  chapters: AudioChapter[];
};

export type AudioManifest = {
  book: {
    bookKey: string;
    title: string;
    author: string | null;
    coverUrl: string | null;
  };
  editions: AudioEdition[];
};

export type AudioStream = {
  url: string;
  startSeconds: number;
  endSeconds: number | null;
  durationSeconds: number;
  mimeType: string;
  expiresInSeconds: number;
};

export type AudioProgress = {
  chapterIndex: number;
  positionSeconds: number;
  playbackRate: number;
  completed: boolean;
  updatedAt: string | null;
};

export async function fetchAudiobooks(): Promise<AudioBookListItem[]> {
  const result = await apiRequest<{ audiobooks?: AudioBookListItem[] }>("/api/v1/catalog/audio");
  return result.audiobooks ?? [];
}

export function fetchAudioManifest(bookKey: string): Promise<AudioManifest> {
  return apiRequest<AudioManifest>(`/api/v1/catalog/books/${encodeURIComponent(bookKey)}/audio`);
}

export function fetchAudioStream(
  bookKey: string,
  audioId: string,
  chapterIndex: number,
  accessToken?: string,
): Promise<AudioStream> {
  return apiRequest<AudioStream>(
    `/api/v1/catalog/books/${encodeURIComponent(bookKey)}/audio/${encodeURIComponent(audioId)}/chapters/${chapterIndex}/stream`,
    { accessToken },
  );
}

export function fetchAudioProgress(
  session: SupabaseSession,
  audioId: string,
): Promise<AudioProgress> {
  return apiRequest<AudioProgress>(`/api/v1/me/audio/${encodeURIComponent(audioId)}`, {
    accessToken: session.access_token,
  });
}

export function saveAudioProgress(
  session: SupabaseSession,
  audioId: string,
  progress: Pick<AudioProgress, "chapterIndex" | "positionSeconds" | "playbackRate" | "completed">,
): Promise<AudioProgress> {
  return apiRequest<AudioProgress>(`/api/v1/me/audio/${encodeURIComponent(audioId)}`, {
    method: "PUT",
    accessToken: session.access_token,
    body: progress,
  });
}

/** Relógio curto: 1:02:03 ou 12:34. */
export function formatAudioClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

export function formatAudioDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min`;
  return `${total} s`;
}

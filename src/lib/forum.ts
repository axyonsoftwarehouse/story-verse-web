import { apiRequest } from "./backend";
import type { SupabaseSession } from "./auth";

export type SpoilerLevel = "none" | "chapter" | "book";

export type ForumSpace = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  topic_count: number;
  last_activity_at: string | null;
};

export type ForumTopic = {
  id: string;
  space_id: string;
  space_slug: string;
  space_name: string;
  author_id: string;
  author_name: string;
  author_avatar: string;
  title: string;
  excerpt?: string;
  body?: string;
  book_key: string | null;
  chapter_ref: string | null;
  spoiler_level: SpoilerLevel;
  status: string;
  is_pinned: boolean;
  is_locked: boolean;
  accepted_reply_id: string | null;
  reply_count: number;
  reaction_count: number;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  bookmarked: boolean;
  liked: boolean;
  saved_at?: string;
};

export type ForumReply = {
  id: string;
  topic_id: string;
  author_id: string;
  author_name: string;
  author_avatar: string;
  parent_id: string | null;
  body: string;
  status: string;
  spoiler_level: SpoilerLevel;
  reaction_count: number;
  liked: boolean;
  created_at: string;
  updated_at: string;
};

export type ForumPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type ForumReport = {
  id: string;
  reporter_id: string;
  target_type: "topic" | "reply";
  target_id: string;
  reason_code: string;
  details: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolution_note: string | null;
  created_at: string;
};

export type TopicFilter = "recent" | "unanswered" | "popular";

type QueryValue = string | number | null | undefined;

function query(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      search.set(key, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export function listSpaces(): Promise<ForumSpace[]> {
  return apiRequest<ForumSpace[]>("/api/v1/forum/spaces");
}

export function listTopics(
  session: SupabaseSession | null,
  options: {
    space?: string;
    book?: string;
    filter?: TopicFilter;
    q?: string;
    cursor?: string | null;
    limit?: number;
  },
): Promise<ForumPage<ForumTopic>> {
  const path = `/api/v1/forum/topics${query({
    space: options.space,
    book: options.book,
    filter: options.filter ?? "recent",
    q: options.q,
    cursor: options.cursor,
    limit: options.limit ?? 20,
  })}`;
  return apiRequest<ForumPage<ForumTopic>>(path, { accessToken: session?.access_token });
}

export function getTopic(session: SupabaseSession | null, id: string): Promise<ForumTopic> {
  return apiRequest<ForumTopic>(`/api/v1/forum/topics/${encodeURIComponent(id)}`, {
    accessToken: session?.access_token,
  });
}

export function listReplies(
  session: SupabaseSession | null,
  topicId: string,
  cursor?: string | null,
  limit = 30,
): Promise<ForumPage<ForumReply>> {
  const path = `/api/v1/forum/topics/${encodeURIComponent(topicId)}/replies${query({ cursor, limit })}`;
  return apiRequest<ForumPage<ForumReply>>(path, { accessToken: session?.access_token });
}

export function createTopic(
  session: SupabaseSession,
  input: {
    space: string;
    title: string;
    body: string;
    bookKey?: string | null;
    chapterRef?: string | null;
    spoilerLevel?: SpoilerLevel;
  },
): Promise<ForumTopic> {
  return apiRequest<ForumTopic>("/api/v1/forum/topics", {
    method: "POST",
    accessToken: session.access_token,
    body: input,
  });
}

export function createReply(
  session: SupabaseSession,
  topicId: string,
  input: { body: string; parentId?: string | null; spoilerLevel?: SpoilerLevel },
): Promise<ForumReply> {
  return apiRequest<ForumReply>(`/api/v1/forum/topics/${encodeURIComponent(topicId)}/replies`, {
    method: "POST",
    accessToken: session.access_token,
    body: input,
  });
}

export function deleteTopic(session: SupabaseSession, id: string): Promise<void> {
  return apiRequest<void>(`/api/v1/forum/topics/${encodeURIComponent(id)}`, {
    method: "DELETE",
    accessToken: session.access_token,
  });
}

export function deleteReply(session: SupabaseSession, id: string): Promise<void> {
  return apiRequest<void>(`/api/v1/forum/replies/${encodeURIComponent(id)}`, {
    method: "DELETE",
    accessToken: session.access_token,
  });
}

export function toggleReaction(
  session: SupabaseSession,
  target: "topic" | "reply",
  id: string,
): Promise<{ liked: boolean; reactionCount: number }> {
  return apiRequest<{ liked: boolean; reactionCount: number }>(
    `/api/v1/forum/${target === "topic" ? "topics" : "replies"}/${encodeURIComponent(id)}/reaction`,
    { method: "POST", accessToken: session.access_token },
  );
}

export function toggleBookmark(
  session: SupabaseSession,
  topicId: string,
): Promise<{ saved: boolean }> {
  return apiRequest<{ saved: boolean }>(
    `/api/v1/forum/topics/${encodeURIComponent(topicId)}/bookmark`,
    {
      method: "POST",
      accessToken: session.access_token,
    },
  );
}

export function acceptReply(
  session: SupabaseSession,
  topicId: string,
  replyId: string,
): Promise<ForumTopic> {
  return apiRequest<ForumTopic>(
    `/api/v1/forum/topics/${encodeURIComponent(topicId)}/accept-reply`,
    {
      method: "POST",
      accessToken: session.access_token,
      body: { replyId },
    },
  );
}

export function reportContent(
  session: SupabaseSession,
  input: {
    targetType: "topic" | "reply";
    targetId: string;
    reasonCode: string;
    details?: string;
  },
): Promise<ForumReport> {
  return apiRequest<ForumReport>("/api/v1/forum/reports", {
    method: "POST",
    accessToken: session.access_token,
    body: input,
  });
}

export function listBookmarks(session: SupabaseSession): Promise<ForumTopic[]> {
  return apiRequest<ForumTopic[]>("/api/v1/forum/me/bookmarks", {
    accessToken: session.access_token,
  });
}

export const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "abuso", label: "Abuso ou ofensa" },
  { value: "assedio", label: "Assédio" },
  { value: "spoiler", label: "Spoiler sem aviso" },
  { value: "fora_do_topico", label: "Fora do tópico" },
  { value: "direitos_autorais", label: "Direitos autorais" },
  { value: "outro", label: "Outro" },
] as const;

export const SPOILER_LABELS: Record<SpoilerLevel, string> = {
  none: "Sem spoiler",
  chapter: "Spoiler do capítulo",
  book: "Spoiler do livro",
};

export function forumDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

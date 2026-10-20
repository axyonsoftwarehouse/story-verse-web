import { apiRequest } from "./backend";
import type { SupabaseSession } from "./auth";

export type AdminForumReport = {
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
  reporter_name: string;
  target_excerpt: string | null;
};

export type AdminForumTopic = {
  id: string;
  space_id: string;
  space_slug: string;
  space_name: string;
  author_id: string;
  author_name: string;
  title: string;
  excerpt: string;
  book_key: string | null;
  chapter_ref: string | null;
  spoiler_level: string;
  status: string;
  is_pinned: boolean;
  is_locked: boolean;
  reply_count: number;
  reaction_count: number;
  created_at: string;
  updated_at: string;
};

export type AdminForumReply = {
  id: string;
  topic_id: string;
  author_id: string;
  parent_id: string | null;
  excerpt: string;
  status: string;
  reaction_count: number;
  created_at: string;
  updated_at: string;
  author_name: string;
  topic_title: string;
};

function query(status: string | null): string {
  return status ? `?status=${encodeURIComponent(status)}` : "";
}

export function listReports(
  session: SupabaseSession,
  status: string | null,
): Promise<AdminForumReport[]> {
  return apiRequest<AdminForumReport[]>(`/api/v1/admin/forum/reports${query(status)}`, {
    accessToken: session.access_token,
  });
}

export function resolveReport(
  session: SupabaseSession,
  id: string,
  status: "actioned" | "dismissed",
  resolutionNote = "",
): Promise<AdminForumReport> {
  return apiRequest<AdminForumReport>(`/api/v1/admin/forum/reports/${encodeURIComponent(id)}`, {
    method: "PATCH",
    accessToken: session.access_token,
    body: { status, resolutionNote },
  });
}

export function listTopics(
  session: SupabaseSession,
  status: string | null,
): Promise<AdminForumTopic[]> {
  return apiRequest<AdminForumTopic[]>(`/api/v1/admin/forum/topics${query(status)}`, {
    accessToken: session.access_token,
  });
}

export function moderateTopic(
  session: SupabaseSession,
  id: string,
  input: { status?: string; pinned?: boolean; locked?: boolean },
): Promise<AdminForumTopic> {
  return apiRequest<AdminForumTopic>(`/api/v1/admin/forum/topics/${encodeURIComponent(id)}`, {
    method: "PATCH",
    accessToken: session.access_token,
    body: input,
  });
}

export function listReplies(
  session: SupabaseSession,
  status: string | null,
): Promise<AdminForumReply[]> {
  return apiRequest<AdminForumReply[]>(`/api/v1/admin/forum/replies${query(status)}`, {
    accessToken: session.access_token,
  });
}

export function moderateReply(
  session: SupabaseSession,
  id: string,
  status: string,
): Promise<AdminForumReply> {
  return apiRequest<AdminForumReply>(`/api/v1/admin/forum/replies/${encodeURIComponent(id)}`, {
    method: "PATCH",
    accessToken: session.access_token,
    body: { status },
  });
}

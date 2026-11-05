import { refreshAuthSession } from "./auth";
import { apiEnabled, apiRequest } from "./backend";
import type { MediaKind } from "./groups";

/** Aviso do sininho: responderam, reagiram, entrou alguém num grupo da conta ou começou a seguir. */
export type AppNotification = {
  id: number;
  kind: "reply" | "reaction" | "member_joined" | "member_added" | "follow";
  /** Nulo no aviso de "começou a seguir você" (não é de grupo). */
  group_id: string | null;
  group_name: string | null;
  message_id: number | null;
  emoji: string | null;
  created_at: string;
  read: boolean;
  actor_id: string;
  actor_name: string;
  actor_avatar: string;
  actor_photo: string | null;
  message_body: string | null;
  message_media_kind: MediaKind | null;
};

async function token(): Promise<string | null> {
  const session = await refreshAuthSession();
  return session.offline ? null : session.access_token;
}

export async function fetchNotifications(): Promise<{ items: AppNotification[]; unread: number }> {
  if (!apiEnabled) return { items: [], unread: 0 };
  const accessToken = await token();
  if (!accessToken) return { items: [], unread: 0 };
  return apiRequest("/api/v1/notifications", { accessToken });
}

export async function markNotificationsRead(): Promise<void> {
  const accessToken = await token();
  if (!accessToken) return;
  await apiRequest("/api/v1/notifications/read", { method: "POST", accessToken });
}

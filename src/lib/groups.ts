import { refreshAuthSession } from "./auth";
import { apiBaseUrl, apiEnabled, apiRequest, AuthSessionError } from "./backend";

/**
 * Grupos com chat (docs/SPEC_GRUPOS.md). Só existem na API própria. Cada chamada pega um token
 * válido na hora (`refreshAuthSession` só renova perto de expirar): a conversa fica aberta por
 * muito tempo e o token da abertura venceria no meio dela.
 */

export const GROUPS_AVAILABLE = apiEnabled;
export const GROUP_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"] as const;
export const MESSAGE_MAX = 2000;
/** Convite aberto sem conta: guardado até a pessoa entrar (o App manda de volta para /g/<código>). */
export const PENDING_INVITE_KEY = "storyverse:pending-invite";

export const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "abuso", label: "Ofensa ou abuso" },
  { value: "assedio", label: "Assédio" },
  { value: "spoiler", label: "Spoiler sem aviso" },
  { value: "outro", label: "Outro motivo" },
] as const;

export type GroupRole = "owner" | "moderator" | "member";

export type GroupMember = {
  user_id: string;
  role: GroupRole;
  joined_at: string;
  name: string;
  avatar: string;
  progress_percent: number | null;
  book_status: string | null;
};

export type Group = {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  /** Fundo da conversa: null = padrão, 'preset:<nome>' ou o endereço de uma imagem enviada. */
  background: string | null;
  visibility: "public" | "private";
  owner_id: string;
  book_key: string | null;
  book_title: string | null;
  book_cover: string | null;
  goal_chapter: number | null;
  goal_until: string | null;
  last_message_at: string | null;
  created_at: string;
  member_count: number;
  is_member: boolean;
  my_role: GroupRole | null;
  muted: boolean;
  last_read_id: number;
  unread: number;
  invite_code: string | null;
  last_message_id: number | null;
  last_author_name: string | null;
  last_body: string | null;
  members?: GroupMember[];
};

export type Reaction = { emoji: string; count: number; mine: boolean };

export type GroupMessage = {
  id: number;
  group_id: string;
  author_id: string;
  author_name: string;
  author_avatar: string;
  body: string | null;
  spoiler_chapter: number | null;
  reply_to: number | null;
  client_id?: string;
  created_at: string;
  deleted: boolean;
  hidden: boolean;
  reactions: Reaction[];
  /** Só no cliente: enviada agora e ainda sem resposta do servidor. */
  pending?: boolean;
  failed?: boolean;
};

export type GroupFields = {
  name: string;
  description?: string | null;
  photoUrl?: string | null;
  background?: string | null;
  visibility: "public" | "private";
  bookKey?: string | null;
  bookTitle?: string | null;
  bookCover?: string | null;
  goalChapter?: number | null;
  goalUntil?: string | null;
};

export type GroupReport = {
  id: string;
  message_id: number;
  reason_code: string;
  details: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  resolution_note: string | null;
  reporter_name: string;
  group_id: string;
  group_name: string;
  author_id: string;
  author_name: string;
  body: string;
  message_created_at: string;
  message_deleted_at: string | null;
  pending_reports: number;
};

async function token(): Promise<string> {
  const session = await refreshAuthSession();
  if (session.offline) throw new AuthSessionError("Sem conexão. Tente de novo quando a internet voltar.");
  return session.access_token;
}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  return apiRequest<T>(path, { ...init, accessToken: await token() });
}

const q = (params: Record<string, string | number | undefined | null>) => {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") search.set(k, String(v));
  const s = search.toString();
  return s ? `?${s}` : "";
};

export const myGroups = () => call<Group[]>("/api/v1/groups");
export const publicGroups = (opts: { q?: string; book?: string } = {}) =>
  call<Group[]>(`/api/v1/groups${q({ scope: "public", q: opts.q, book: opts.book })}`);
export const getGroup = (id: string) => call<Group>(`/api/v1/groups/${id}`);
export const createGroup = (fields: GroupFields) => call<Group>("/api/v1/groups", { method: "POST", body: fields });
export const updateGroup = (id: string, fields: Partial<GroupFields>) =>
  call<Group>(`/api/v1/groups/${id}`, { method: "PATCH", body: fields });
export const deleteGroup = (id: string) => call<void>(`/api/v1/groups/${id}`, { method: "DELETE" });
export const joinGroup = (id: string) => call<Group>(`/api/v1/groups/${id}/join`, { method: "POST" });
export const joinByInvite = (code: string) =>
  call<Group>(`/api/v1/groups/join/${encodeURIComponent(code)}`, { method: "POST" });
export const leaveGroup = (id: string) => call<void>(`/api/v1/groups/${id}/leave`, { method: "POST" });
export const rotateInvite = (id: string) => call<Group>(`/api/v1/groups/${id}/invite/rotate`, { method: "POST" });
export const setMuted = (id: string, muted: boolean) =>
  call<Group>(`/api/v1/groups/${id}/mute`, { method: "POST", body: { muted } });
export const markRead = (id: string, lastId: number) =>
  call<void>(`/api/v1/groups/${id}/read`, { method: "POST", body: { lastId } });
/** Avisa os outros membros que a conta está digitando (vale uns segundos; a API ignora repetições). */
export const sendTyping = (id: string) => call<void>(`/api/v1/groups/${id}/typing`, { method: "POST" });
export const removeMember = (id: string, userId: string) =>
  call<void>(`/api/v1/groups/${id}/members/${userId}`, { method: "DELETE" });
export const setMemberRole = (id: string, userId: string, role: GroupRole) =>
  call<Group>(`/api/v1/groups/${id}/members/${userId}`, { method: "PATCH", body: { role } });

export const listMessages = (id: string, opts: { before?: number; after?: number; limit?: number } = {}) =>
  call<GroupMessage[]>(`/api/v1/groups/${id}/messages${q(opts)}`);
export const sendMessage = (
  id: string,
  body: { body: string; clientId: string; spoilerChapter?: number | null; replyTo?: number | null },
) => call<GroupMessage>(`/api/v1/groups/${id}/messages`, { method: "POST", body });
export const deleteMessage = (messageId: number) =>
  call<void>(`/api/v1/groups/messages/${messageId}`, { method: "DELETE" });
export const react = (messageId: number, emoji: string, add: boolean) =>
  add
    ? call<Reaction[]>(`/api/v1/groups/messages/${messageId}/reactions`, { method: "PUT", body: { emoji } })
    : call<Reaction[]>(`/api/v1/groups/messages/${messageId}/reactions${q({ emoji })}`, { method: "DELETE" });
export const reportMessage = (messageId: number, reasonCode: string, details?: string) =>
  call<unknown>(`/api/v1/groups/messages/${messageId}/report`, { method: "POST", body: { reasonCode, details } });

export const adminGroupReports = (status?: string) =>
  call<GroupReport[]>(`/api/v1/admin/groups/reports${q({ status })}`);
export const resolveGroupReport = (id: string, status: "actioned" | "dismissed", deleteMessage: boolean, note?: string) =>
  call<unknown>(`/api/v1/admin/groups/reports/${id}`, {
    method: "PATCH",
    body: { status, deleteMessage, resolutionNote: note },
  });

/** Link de convite que a pessoa compartilha. */
export function inviteUrl(code: string): string {
  return `${window.location.origin}/g/${code}`;
}

/* ------------------------------ Tempo real ------------------------------ */

export type StreamEvent =
  | { type: "ready" }
  | { type: "message"; data: GroupMessage }
  | { type: "message_deleted"; data: { groupId: string; id: number } }
  | { type: "reaction"; data: { groupId: string; messageId: number; emoji: string; userId: string; added: boolean } }
  | { type: "group"; data: { groupId: string; type: string; userId?: string } }
  | { type: "typing"; data: { groupId: string; userId: string } };

/** Quanto tempo o "digitando" fica na tela sem um aviso novo. */
export const TYPING_SHOWN_MS = 6000;
/** Intervalo mínimo entre dois avisos de "digitando" desta conta. */
export const TYPING_SEND_MS = 3000;

/** "Ana está digitando…", "Ana e Bia estão digitando…", "Ana e mais 2 estão digitando…". */
export function typingLabel(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} está digitando…`;
  if (names.length === 2) return `${names[0]} e ${names[1]} estão digitando…`;
  return `${names[0]} e mais ${names.length - 1} estão digitando…`;
}

/** Lê um corpo SSE (text/event-stream) e chama `onEvent` a cada evento completo. */
export function parseSse(buffer: string, onEvent: (name: string, data: string) => void): string {
  const blocks = buffer.split(/\r?\n\r?\n/);
  const rest = blocks.pop() ?? "";
  for (const block of blocks) {
    let name = "message";
    const data: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith(":")) continue;
      if (line.startsWith("event:")) name = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    if (data.length) onEvent(name, data.join("\n"));
  }
  return rest;
}

/**
 * Conexão única com os eventos de todos os grupos da conta. Usa fetch (não EventSource) para
 * mandar o token no cabeçalho. Cai e volta sozinha; `onReconnect` avisa para buscar o que
 * chegou enquanto estava fora. Devolve a função que fecha.
 */
export function openGroupStream(onEvent: (event: StreamEvent) => void, onReconnect?: () => void): () => void {
  if (!GROUPS_AVAILABLE) return () => {};
  let stopped = false;
  let controller: AbortController | null = null;
  let attempt = 0;
  let connectedOnce = false;
  let timer: number | undefined;

  const schedule = () => {
    if (stopped) return;
    // 1 s, 2 s, 4 s… até 30 s entre tentativas.
    const wait = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
    attempt++;
    timer = window.setTimeout(connect, wait);
  };

  const connect = async () => {
    if (stopped) return;
    controller = new AbortController();
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/groups/stream`, {
        headers: { Accept: "text/event-stream", Authorization: `Bearer ${await token()}` },
        credentials: "include",
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error(`stream ${response.status}`);
      attempt = 0;
      if (connectedOnce) onReconnect?.();
      connectedOnce = true;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer = parseSse(buffer + decoder.decode(value, { stream: true }), (name, data) => {
          try {
            onEvent({ type: name, data: JSON.parse(data) } as StreamEvent);
          } catch {
            // Evento malformado: ignora.
          }
        });
      }
    } catch {
      // Rede caiu, token venceu ou o servidor fechou: tenta de novo.
    }
    schedule();
  };

  void connect();
  return () => {
    stopped = true;
    window.clearTimeout(timer);
    controller?.abort();
  };
}

/* ------------------------------ Apoio ------------------------------ */

export function newClientId(): string {
  return crypto.randomUUID();
}

/** Aplica um evento de reação numa mensagem (soma ou tira 1; "mine" quando a reação é minha). */
export function applyReaction(message: GroupMessage, emoji: string, added: boolean, mine: boolean): GroupMessage {
  const list = message.reactions.map((r) => ({ ...r }));
  const found = list.find((r) => r.emoji === emoji);
  if (found) {
    found.count = Math.max(0, found.count + (added ? 1 : -1));
    if (mine) found.mine = added;
  } else if (added) {
    list.push({ emoji, count: 1, mine });
  }
  return { ...message, reactions: list.filter((r) => r.count > 0) };
}

/** Junta mensagens novas às que já estão na tela, sem repetir e em ordem de id. */
export function mergeMessages(current: GroupMessage[], incoming: GroupMessage[]): GroupMessage[] {
  const byKey = new Map<string, GroupMessage>();
  for (const m of current) byKey.set(m.pending || m.failed ? `c:${m.client_id}` : `id:${m.id}`, m);
  for (const m of incoming) {
    // A mensagem confirmada pelo servidor substitui a provisória com o mesmo clientId.
    if (m.client_id) byKey.delete(`c:${m.client_id}`);
    const old = byKey.get(`id:${m.id}`);
    byKey.set(`id:${m.id}`, old && !m.reactions.length && old.reactions.length ? { ...m, reactions: old.reactions } : m);
  }
  return [...byKey.values()].sort((a, b) => (a.pending || a.failed ? 1 : 0) - (b.pending || b.failed ? 1 : 0) || a.id - b.id);
}

/** "14:32" hoje, "ontem 14:32" ou "12 out 14:32". */
export function messageTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const day = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  if (day(d) === day(now)) return time;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (day(d) === day(yesterday)) return `ontem ${time}`;
  return `${d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(" de ", " ").replace(".", "")} ${time}`;
}

/* ------------------------- Avisos com o app aberto ------------------------- */

/** Sem Web Push: o aviso só sai com o app aberto (em outra aba ou minimizado). */
const lastNotified = new Map<string, number>();
const NOTIFY_EVERY_MS = 5 * 60_000;

export function notificationsAvailable(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Pede permissão para avisar (só depois de um toque da pessoa). */
export async function enableGroupNotifications(): Promise<boolean> {
  if (!notificationsAvailable()) return false;
  return (await Notification.requestPermission()) === "granted";
}

/**
 * Aviso de mensagem nova quando a tela não está visível: no máximo 1 por grupo a cada 5 minutos,
 * nunca para grupo silenciado.
 */
export function notifyGroupMessage(m: GroupMessage, groupName: string, muted: boolean) {
  if (muted || !notificationsAvailable() || Notification.permission !== "granted") return;
  if (document.visibilityState === "visible") return;
  const now = Date.now();
  if (now - (lastNotified.get(m.group_id) ?? 0) < NOTIFY_EVERY_MS) return;
  lastNotified.set(m.group_id, now);
  try {
    const n = new Notification(groupName, {
      body: `${m.author_name}: ${m.spoiler_chapter ? "🙈 mensagem com spoiler" : (m.body ?? "").slice(0, 140)}`,
      icon: "/icons/icon-192.png",
      tag: `group-${m.group_id}`,
    });
    n.onclick = () => {
      window.focus();
      window.location.assign(`/grupos/${m.group_id}`);
    };
  } catch {
    // Alguns navegadores (Android) só aceitam notificação pelo service worker: fica só o selo.
  }
}

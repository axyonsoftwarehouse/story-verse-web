import { refreshAuthSession } from "./auth";
import { apiEnabled, apiRequest, AuthSessionError } from "./backend";
import type { Cosmetics } from "./shop";

/**
 * Rede social: seguir perfis. Seguir é de mão única; quando as duas pessoas se seguem, viram
 * "conexão". Só existe na API própria e usa a mesma liberação dos grupos (feature `groups`).
 */

export type Person = {
  id: string;
  name: string;
  avatar: string;
  /** Foto do perfil (só arquivo do Storage da própria pessoa; a API filtra). */
  photo: string | null;
  /** A conta logada segue esta pessoa. */
  is_following: boolean;
  /** Esta pessoa segue a conta logada. */
  follows_me: boolean;
  /** Perfil privado: seguir vira pedido, e leituras e listas ficam para quem segue. */
  is_private?: boolean;
  /** A conta logada pediu para seguir e a pessoa ainda não respondeu. */
  requested?: boolean;
  /** Nas listas: desde quando segue / é seguida. */
  since?: string;
  /** Nas sugestões: quantos grupos as duas dividem. */
  groups_in_common?: number;
  /** Moldura, insígnia e cor de nome equipadas na loja. */
  cosmetics?: Cosmetics | null;
};

export type ProfileBook = {
  book_key: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  status: "reading" | "finished";
  rating: number | null;
  progress_percent: number | null;
  finished_on: string | null;
};

export type ProfileBadge = { id: string; emoji: string; title: string; description?: string };
export type ProfileGift = { gift_id: string; name: string; icon: string; rarity: "common" | "rare" | "epic"; total: number };
/** Insígnia da loja na estante do perfil. */
export type ShelfBadge = { id: string; name: string; image: string };
export type ProfileStats = { totalMinutes?: number; bestStreak?: number; finishedBooks?: number; messagesSent?: number };

export type PersonProfile = Person & {
  is_me: boolean;
  member_since: string;
  /** Biografia que a pessoa escreveu (até 160 caracteres e 4 linhas). */
  bio?: string | null;
  /** A conta logada vê leituras e listas (é ela, o perfil é público ou ela segue). */
  content_visible?: boolean;
  /** Só no próprio perfil: pedidos para seguir esperando resposta. */
  pending_requests?: number;
  followers: number;
  following: number;
  /** Quantas pessoas seguem e são seguidas de volta por este perfil. */
  connections: number;
  groups_in_common: number;
  /** A pessoa escolheu mostrar leituras, conquistas e presentes (só faz diferença no próprio perfil). */
  show_reading: boolean;
  /** Quem vê não pode ver as leituras (a pessoa escondeu). */
  reading_hidden: boolean;
  books: ProfileBook[];
  reading_counts: { reading: number; finished: number };
  gifts: ProfileGift[];
  badges: ProfileBadge[];
  /** Quantas conquistas existem (para "6 de 17"). 0: o app da pessoa ainda não publicou. */
  badges_total: number;
  stats: ProfileStats;
  /** Capa comprada equipada (só quando `content_visible`). */
  shop_cover?: string | null;
  /** Foto de capa enviada pela pessoa (só quando `content_visible`). */
  cover?: string | null;
  /** Insígnias da loja que a pessoa tem (só quando `content_visible`). */
  badge_shelf?: ShelfBadge[];
};

export type Relation = "self" | "connection" | "following" | "requested" | "follows_me" | "none";

/** Como a conta logada se relaciona com a pessoa (rótulo do botão e do selo). */
export function relationOf(p: Pick<Person, "is_following" | "follows_me" | "requested"> & { is_me?: boolean }): Relation {
  if (p.is_me) return "self";
  if (p.is_following && p.follows_me) return "connection";
  if (p.is_following) return "following";
  if (p.requested) return "requested";
  if (p.follows_me) return "follows_me";
  return "none";
}

/** Texto do botão de seguir para cada relação. */
export function followLabel(relation: Relation): string {
  switch (relation) {
    case "connection":
      return "Conectados";
    case "following":
      return "Seguindo";
    case "requested":
      return "Pedido enviado";
    case "follows_me":
      return "Seguir de volta";
    default:
      return "Seguir";
  }
}

/** "1 seguidor", "2,3 mil seguidores". */
export function countLabel(n: number, one: string, many: string): string {
  const value = n >= 10_000 ? `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : n.toLocaleString("pt-BR");
  return `${value} ${n === 1 ? one : many}`;
}

/** "Membro desde mar. de 2026". */
export function memberSince(iso: string): string {
  return `Membro desde ${new Date(iso).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}`;
}

export function errorText(error: unknown, fallback = "Não foi possível carregar agora."): string {
  return error instanceof Error ? error.message : fallback;
}

async function token(): Promise<string> {
  const session = await refreshAuthSession();
  if (session.offline) throw new AuthSessionError("Sem conexão. Tente de novo quando a internet voltar.");
  return session.access_token;
}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  return apiRequest<T>(path, { ...init, accessToken: await token() });
}

const id = (value: string) => encodeURIComponent(value);

export const PEOPLE_PAGE = 30;

export const searchPeople = (q: string) => call<Person[]>(`/api/v1/social/people?q=${encodeURIComponent(q)}`);
export const peopleSuggestions = () => call<Person[]>("/api/v1/social/people/suggestions");
export const getPerson = (userId: string) => call<PersonProfile>(`/api/v1/social/people/${id(userId)}`);
export const followersOf = (userId: string, offset = 0) =>
  call<Person[]>(`/api/v1/social/people/${id(userId)}/followers?limit=${PEOPLE_PAGE}&offset=${offset}`);
export const followingOf = (userId: string, offset = 0) =>
  call<Person[]>(`/api/v1/social/people/${id(userId)}/following?limit=${PEOPLE_PAGE}&offset=${offset}`);
export const follow = (userId: string) => call<PersonProfile>(`/api/v1/social/people/${id(userId)}/follow`, { method: "PUT" });
export const unfollow = (userId: string) => call<PersonProfile>(`/api/v1/social/people/${id(userId)}/follow`, { method: "DELETE" });
export const removeFollower = (userId: string) => call<void>(`/api/v1/social/me/followers/${id(userId)}`, { method: "DELETE" });
export const booksOf = (userId: string, offset = 0) =>
  call<ProfileBook[]>(`/api/v1/social/people/${id(userId)}/books?limit=24&offset=${offset}`);
export type Privacy = { show_reading: boolean; is_private: boolean; accepted_requests: number };
/** Mostrar as leituras e/ou perfil privado (manda só o que mudou). */
export const setPrivacy = (body: { showReading?: boolean; private?: boolean }) =>
  call<Privacy>("/api/v1/social/me/privacy", { method: "PUT", body });
export const setShowReading = (showReading: boolean) => setPrivacy({ showReading });

/** Pedidos para seguir que a conta recebeu (perfil privado). */
export const followRequests = (offset = 0) =>
  call<Person[]>(`/api/v1/social/me/follow-requests?limit=${PEOPLE_PAGE}&offset=${offset}`);
export const acceptFollowRequest = (userId: string) =>
  call<void>(`/api/v1/social/me/follow-requests/${id(userId)}`, { method: "PUT" });
export const declineFollowRequest = (userId: string) =>
  call<void>(`/api/v1/social/me/follow-requests/${id(userId)}`, { method: "DELETE" });

type ShowcaseBadge = { id: string; emoji: string; title: string; description: string; unlocked: boolean };

/**
 * Publica no perfil as conquistas desbloqueadas e alguns números de leitura. Só manda quando
 * algo mudou desde a última vez (guardado por conta neste aparelho). Falha calada: é enfeite.
 */
export async function publishShowcase(userId: string, badges: ShowcaseBadge[], stats: ProfileStats): Promise<void> {
  if (!apiEnabled || !userId) return;
  const body = {
    badges: badges.filter((b) => b.unlocked).map(({ id: badgeId, emoji, title, description }) => ({ id: badgeId, emoji, title, description })),
    total: badges.length,
    stats,
  };
  const key = `storyverse:showcase:${userId}`;
  const signature = JSON.stringify(body);
  try {
    if (localStorage.getItem(key) === signature) return;
  } catch {
    // Sem armazenamento: publica de qualquer jeito.
  }
  try {
    await call<void>("/api/v1/social/me/showcase", { method: "PUT", body });
    try {
      localStorage.setItem(key, signature);
    } catch {
      // Sem armazenamento: tenta de novo na próxima vez.
    }
  } catch {
    // Sem a liberação da comunidade, offline ou limite: tenta de novo depois.
  }
}

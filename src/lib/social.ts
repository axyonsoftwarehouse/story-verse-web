import { refreshAuthSession } from "./auth";
import { apiRequest, AuthSessionError } from "./backend";

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
  /** Nas listas: desde quando segue / é seguida. */
  since?: string;
  /** Nas sugestões: quantos grupos as duas dividem. */
  groups_in_common?: number;
};

export type PersonProfile = Person & {
  is_me: boolean;
  member_since: string;
  followers: number;
  following: number;
  /** Quantas pessoas seguem e são seguidas de volta por este perfil. */
  connections: number;
  groups_in_common: number;
};

export type Relation = "self" | "connection" | "following" | "follows_me" | "none";

/** Como a conta logada se relaciona com a pessoa (rótulo do botão e do selo). */
export function relationOf(p: Pick<Person, "is_following" | "follows_me"> & { is_me?: boolean }): Relation {
  if (p.is_me) return "self";
  if (p.is_following && p.follows_me) return "connection";
  if (p.is_following) return "following";
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

async function call<T>(path: string, init: { method?: string } = {}): Promise<T> {
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

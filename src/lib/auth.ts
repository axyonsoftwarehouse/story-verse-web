import { userStorage } from "./dataOwner";
import { captureError, captureEvent } from "./telemetry";
import { apiEnabled, apiRequest, ApiHttpError, AuthNetworkError, AuthSessionError } from "./backend";

export { AuthNetworkError, AuthSessionError };

/**
 * O login existe com o Supabase (padrão) ou com a API própria, quando `VITE_API_URL` está
 * definida. Sem nenhum dos dois, o app funciona como antes, sem contas.
 */
export const authEnabled = apiEnabled || Boolean(
  import.meta.env.VITE_SUPABASE_URL?.trim() && import.meta.env.VITE_SUPABASE_ANON_KEY?.trim(),
);
/** Conta obrigatória para ler e importar. `VITE_LOGIN_REQUIRED=false` deixa a conta opcional. */
export const loginRequired = authEnabled && import.meta.env.VITE_LOGIN_REQUIRED?.trim() !== "false";

/** Chave antiga que guardava a sessão inteira (tokens). Só é lida para apagar. */
const SESSION_KEY = "storyverse:supabase-session";
/** Metadados não sensíveis da sessão (sem tokens), observados por outras abas. */
const SESSION_META_KEY = "storyverse:session-meta";
export const AUTH_SESSION_STORAGE_KEY = SESSION_META_KEY;
const LEGACY_AUTH_KEY = "storyverse:auth";
const LOGOUT_PENDING_KEY = "storyverse:logout-pending";
/** A API própria ainda não tem OTP; com ela, o código de 6 dígitos fica desligado. */
export const EMAIL_OTP_ENABLED = !apiEnabled && import.meta.env.VITE_SUPABASE_EMAIL_OTP_ENABLED === "true";

export type SupabaseUser = {
  id: string;
  email: string;
  created_at?: string;
  user_metadata?: Record<string, unknown>;
};

export type SanctionNotice = {
  kind: string;
  reason: string | null;
  expiresAt: string | null;
};

export type SupabaseSession = {
  access_token: string;
  /** Vazio na API própria: o refresh token fica em cookie HttpOnly, fora do JavaScript. */
  refresh_token: string;
  expires_at: number;
  user: SupabaseUser;
  /** Sessão restaurada do marcador local sem rede; não serve para chamadas autenticadas. */
  offline?: boolean;
  warning?: SanctionNotice;
};

type AuthResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  user?: SupabaseUser;
  msg?: string;
  message?: string;
  error_description?: string;
};

function authConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    throw new Error("Autenticação indisponível: configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
  }
  try {
    const parsed = new URL(url);
    const localDevelopment = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !localDevelopment) {
      throw new Error("A conexão com o Supabase precisa usar HTTPS.");
    }
  } catch {
    throw new Error("A URL do Supabase é inválida ou não usa uma conexão segura.");
  }
  return { url, anonKey };
}

/** Endereço e chave pública do Supabase, para as outras chamadas (banco e arquivos). */
export function supabaseConfig() {
  return authConfig();
}

function describeAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (normalized.includes("user already registered")) return "Já existe uma conta com este e-mail. Faça login.";
  if (normalized.includes("email not confirmed")) return "Confirme seu e-mail antes de fazer login.";
  if (normalized.includes("password should be at least")) return "A senha precisa ter pelo menos 8 caracteres.";
  if (normalized.includes("signup is disabled")) return "O cadastro está temporariamente indisponível.";
  if (normalized.includes("too many requests")) return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  if (normalized.includes("token has expired or is invalid")) {
    return "Código inválido ou expirado. Confira os números ou peça um novo código.";
  }
  if (normalized.includes("for security purposes")) return "Aguarde alguns segundos antes de pedir um novo código.";
  if (normalized.includes("rate limit")) return "Muitos e-mails enviados agora. Aguarde alguns minutos e tente de novo.";
  if (normalized.includes("email address") && normalized.includes("invalid")) return "Este endereço de e-mail não é aceito.";
  if (normalized.includes("not authorized")) return "Este e-mail ainda não pode receber mensagens do Storyverse.";
  return message;
}

/** Resposta da API própria de contas (ver story-verse-api). */
type ApiUser = {
  id: string;
  email: string;
  created_at?: string;
  user_metadata?: Record<string, unknown>;
  /** Compatibilidade com a versão anterior da API. */
  name?: string | null;
};
type ApiAuthResponse = { accessToken: string; expiresIn?: number; user: ApiUser; activeWarning?: SanctionNotice | null };
type ApiSignupPending = { message?: string };

function apiToUser(user: ApiUser): SupabaseUser {
  return {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    user_metadata: user.user_metadata ?? (user.name ? { name: user.name } : {}),
  };
}

function apiToSession(payload: ApiAuthResponse): SupabaseSession {
  if (!payload?.accessToken || !payload?.user) {
    throw new Error("O serviço não retornou uma sessão válida.");
  }
  return {
    access_token: payload.accessToken,
    // O refresh token vive no cookie HttpOnly; qualquer campo devolvido no JSON é ignorado.
    refresh_token: "",
    // Pelo relógio do aparelho (expiresIn), como no caminho do Supabase.
    expires_at:
      Math.floor(Date.now() / 1000) + (payload.expiresIn && payload.expiresIn > 0 ? payload.expiresIn : 3600),
    user: apiToUser(payload.user),
    warning: payload.activeWarning ?? undefined,
  };
}

async function authRequest(
  path: string,
  body?: Record<string, unknown>,
  accessToken?: string,
  method: "POST" | "PUT" | "GET" = "POST",
): Promise<AuthResponse> {
  const { url, anonKey } = authConfig();
  let response: Response;
  try {
    response = await fetch(`${url}/auth/v1/${path}`, {
      method,
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      // Rede muito lenta não pode prender o app na tela de abertura.
      signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(10_000) : undefined,
    });
  } catch (error) {
    captureError("auth-network", error, { path });
    throw new AuthNetworkError("Não foi possível conectar ao serviço de autenticação. Verifique sua conexão.");
  }
  const payload = (await response.json().catch(() => ({}))) as AuthResponse;
  const serverMessage = payload.msg ?? payload.message ?? payload.error_description ?? "";
  // Falha no SMTP configurado no Supabase (vem como 500, mas não é o serviço fora do ar).
  if (/error sending .*email/i.test(serverMessage)) {
    throw new Error("Não conseguimos enviar o e-mail agora. Tente de novo em alguns minutos.");
  }
  // Limite de requisições (429): espera e tenta depois, sem deslogar ninguém.
  if (response.status === 429) {
    captureEvent("warn", "auth-http", "limite de requisições do auth (429)", { path });
    throw new AuthNetworkError(describeAuthError(serverMessage || "too many requests"));
  }
  // Supabase fora do ar também não é motivo para deslogar.
  if (response.status >= 500) {
    captureError("auth-http", new Error(serverMessage || "auth indisponível"), { status: response.status, path });
    throw new AuthNetworkError("O serviço de autenticação está instável. Tente de novo em instantes.");
  }

  if (!response.ok) {
    throw new Error(describeAuthError(serverMessage || "Falha na autenticação."));
  }
  return payload;
}

function makeSession(payload: AuthResponse): SupabaseSession | null {
  if (!payload.access_token || !payload.refresh_token || !payload.user) return null;
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    // Pelo relógio do aparelho (expires_in): com o relógio adiantado, o expires_at do servidor
    // parecia sempre vencido e o app renovava a sessão sem parar.
    expires_at: payload.expires_in
      ? Math.floor(Date.now() / 1000) + payload.expires_in
      : payload.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
    user: payload.user,
  };
}

let currentSession: SupabaseSession | null = null;
let authGeneration = 0;

function metaUserId(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_META_KEY);
    if (!raw) return null;
    const meta = JSON.parse(raw) as { user?: SupabaseUser };
    return meta?.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Este navegador pode ter um cookie de sessão? Login sempre grava os metadados e logout os
 * apaga; sem eles não há o que renovar. Sem acesso ao armazenamento não dá para saber: tenta.
 */
function mayHaveSession(): boolean {
  try {
    return localStorage.getItem(SESSION_META_KEY) !== null;
  } catch {
    return true;
  }
}

/** Metadados sem tokens: permitem lembrar quem estava logado e sincronizar abas. */
function writeSessionMeta(session: SupabaseSession | null): void {
  try {
    if (session) {
      localStorage.setItem(
        SESSION_META_KEY,
        JSON.stringify({ user: session.user, expires_at: session.expires_at }),
      );
    } else {
      localStorage.removeItem(SESSION_META_KEY);
    }
  } catch {
    // Sem armazenamento: a sessão segue só em memória.
  }
}

/** Sessão offline (sem access token) para o app abrir com os dados locais sem rede. */
function offlineSession(): SupabaseSession | null {
  try {
    const raw = localStorage.getItem(SESSION_META_KEY);
    if (!raw) return null;
    const meta = JSON.parse(raw) as { user?: SupabaseUser; expires_at?: number };
    if (!meta?.user?.id || !Number.isFinite(meta.expires_at)) return null;
    return {
      access_token: "",
      refresh_token: "",
      expires_at: Number(meta.expires_at),
      user: meta.user,
      offline: true,
    };
  } catch {
    return null;
  }
}

function storeSession(session: SupabaseSession | null, signal = true) {
  authGeneration += 1;
  currentSession = session;
  if (!apiEnabled) {
    // Caminho legado do Supabase (desenvolvimento): mantém o comportamento antigo.
    if (session) userStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else userStorage.removeItem(SESSION_KEY);
    return;
  }
  // Só login/logout/troca de conta sinalizam outras abas. Renovação e edição de perfil não
  // escrevem de novo; senão as abas ficariam disparando renovação uma da outra (e uma renovação
  // atrasada poderia ressuscitar uma sessão que a outra aba acabou de encerrar).
  const nextUser = session?.user.id ?? null;
  const previousUser = metaUserId();
  if (nextUser === null) {
    if (previousUser !== null) writeSessionMeta(null);
  } else if (signal && nextUser !== previousUser) {
    writeSessionMeta(session);
  }
}

export function clearLegacyCredentials() {
  userStorage.removeItem(LEGACY_AUTH_KEY);
  if (!apiEnabled) return;
  // A versão antiga guardava a sessão inteira (com refresh token) nesta chave.
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Sem armazenamento.
  }
}

export async function signInWithPassword(email: string, password: string): Promise<SupabaseSession> {
  if (apiEnabled) {
    const payload = await apiRequest<ApiAuthResponse>("/api/v1/auth/login", { method: "POST", body: { email, password } });
    const session = apiToSession(payload);
    storeSession(session);
    return session;
  }
  const payload = await authRequest("token?grant_type=password", { email, password });
  const session = makeSession(payload);
  if (!session) throw new Error("O serviço não retornou uma sessão válida.");
  storeSession(session);
  return session;
}

export async function signUpWithPassword(
  email: string,
  password: string,
  name: string,
): Promise<SupabaseSession | null> {
  if (apiEnabled) {
    // Com confirmação de e-mail, a API responde 202 sem tokens: a tela mostra "confira seu e-mail".
    const payload = await apiRequest<ApiAuthResponse | ApiSignupPending>("/api/v1/auth/signup", {
      method: "POST",
      body: { email, password, name },
    });
    if (!("accessToken" in payload) || !payload.accessToken) {
      storeSession(null);
      return null;
    }
    const session = apiToSession(payload);
    storeSession(session);
    return session;
  }
  const redirect = encodeURIComponent(window.location.origin);
  const payload = await authRequest(`signup?redirect_to=${redirect}`, {
    email,
    password,
    data: { name },
  });
  const session = makeSession(payload);
  storeSession(session);
  return session;
}

export async function verifySignupCode(email: string, token: string): Promise<SupabaseSession> {
  if (apiEnabled) {
    throw new Error("A confirmação por código ainda não está disponível nesta versão.");
  }
  const payload = await authRequest("verify", { type: "signup", email, token });
  const session = makeSession(payload);
  if (!session) throw new Error("Código confirmado, mas o serviço não retornou uma sessão válida.");
  storeSession(session);
  return session;
}

export async function resendSignupCode(email: string): Promise<void> {
  if (apiEnabled) {
    await apiRequest("/api/v1/auth/resend-confirmation", { method: "POST", body: { email } });
    return;
  }
  await authRequest("resend", { type: "signup", email });
}

/**
 * Sessão atual em memória (API própria). Na API os tokens nunca vão para o localStorage; o
 * refresh token fica no cookie HttpOnly e o access token só vive aqui.
 */
export function storedAuthSession(): SupabaseSession | null {
  if (apiEnabled) return currentSession;
  try {
    const raw = userStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SupabaseSession) : null;
  } catch {
    return null;
  }
}

let refreshQueue: Promise<unknown> = Promise.resolve();

/**
 * Renova pelo cookie HttpOnly. Chamadas concorrentes são serializadas e reaproveitam a sessão
 * recém-criada, sem girar o refresh token várias vezes.
 */
export function refreshAuthSession(force = false): Promise<SupabaseSession> {
  const callGeneration = authGeneration;
  const run = async () => {
    const current = storedAuthSession();
    // Outra aba renovou/trocou a sessão enquanto esta chamada esperava na fila.
    if (authGeneration !== callGeneration) {
      if (current && !current.offline && current.expires_at * 1000 > Date.now() + 60_000) {
        return current;
      }
      throw new AuthSessionError("A sessão mudou durante a renovação.");
    }
    if (!force && current && !current.offline && current.expires_at * 1000 > Date.now() + 60_000) {
      return current;
    }
    return refreshSessionOnce();
  };
  const locked = () => navigator.locks?.request
    ? navigator.locks.request("storyverse:auth-refresh", run) : run();
  const result = refreshQueue.then(locked, locked);
  refreshQueue = result.catch(() => {});
  return result;
}

async function refreshSessionOnce(): Promise<SupabaseSession> {
  const startedGeneration = authGeneration;

  if (apiEnabled) {
    const payload = await apiRequest<ApiAuthResponse>("/api/v1/auth/refresh", { method: "POST", body: {} });
    if (authGeneration !== startedGeneration) {
      throw new AuthSessionError("A sessão mudou durante a renovação.");
    }
    const session = apiToSession(payload);
    storeSession(session, false);
    return session;
  }

  const refreshToken = storedAuthSession()?.refresh_token;
  if (!refreshToken) throw new AuthSessionError("Sessão expirada. Entre novamente.");
  const payload = await authRequest("token?grant_type=refresh_token", { refresh_token: refreshToken });
  if (authGeneration !== startedGeneration) {
    throw new AuthSessionError("A sessão mudou durante a renovação.");
  }
  const session = makeSession(payload);
  if (!session) throw new Error("Não foi possível renovar a sessão. Entre novamente.");
  storeSession(session, false);
  return session;
}

async function restoreAuthSessionOnce(): Promise<SupabaseSession | null> {
  clearLegacyCredentials();
  if (apiEnabled) {
    // Logout feito offline: revoga o cookie assim que a rede voltar, antes de restaurar.
    try {
      if (localStorage.getItem(LOGOUT_PENDING_KEY)) {
        await apiRequest("/api/v1/auth/logout", { method: "POST", body: {} });
        localStorage.removeItem(LOGOUT_PENDING_KEY);
      }
    } catch (error) {
      if (error instanceof AuthNetworkError) return null;
    }
    // Quem nunca entrou (ou saiu) abre na hora, sem esperar a API responder que não há sessão.
    if (!mayHaveSession()) return null;
    const generation = authGeneration;
    try {
      return await refreshAuthSession();
    } catch (error) {
      // Sem internet (app instalado/offline): abre com os dados locais e renova depois.
      if (error instanceof AuthNetworkError) {
        currentSession = offlineSession();
        return currentSession;
      }
      // Outra aba pode ter trocado/encerrado a sessão enquanto esta renovava.
      if (authGeneration !== generation) return storedAuthSession();
      // Cookie inválido/expirado: não há como autenticar.
      storeSession(null);
      return null;
    }
  }

  // Caminho legado do Supabase (desenvolvimento): a sessão completa fica no armazenamento.
  const stored = userStorage.getItem(SESSION_KEY);
  if (!stored) return null;
  let session: SupabaseSession;
  try {
    session = JSON.parse(stored) as SupabaseSession;
  } catch {
    storeSession(null);
    return null;
  }
  if (
    !session.access_token ||
    !session.refresh_token ||
    !session.user?.id ||
    !Number.isFinite(session.expires_at)
  ) {
    storeSession(null);
    return null;
  }
  if (session.expires_at * 1000 <= Date.now() + 60_000) {
    try {
      return await refreshAuthSession();
    } catch (error) {
      if (error instanceof AuthNetworkError) return session;
      storeSession(null);
      throw error;
    }
  }
  currentSession = session;
  return session;
}

/**
 * Link do e-mail (confirmação de cadastro ou "esqueci minha senha"): o Supabase volta para o
 * site com a sessão no endereço (#access_token=…&refresh_token=…&type=signup|recovery). Aqui ela
 * vira a sessão do app e sai da barra de endereço.
 */
type RedirectResult =
  | { session: SupabaseSession; type: string }
  | { resetToken: string; type: "recovery" }
  | { error: string }
  | null;
let redirectResult: Promise<RedirectResult> | null = null;

/** Lê o link uma vez só por carregamento (o React em desenvolvimento roda os efeitos duas vezes). */
export function consumeAuthRedirect(): Promise<RedirectResult> {
  redirectResult ??= readAuthRedirect();
  return redirectResult;
}

async function readAuthRedirect(): Promise<RedirectResult> {
  if (apiEnabled) return readApiAuthRedirect();
  const hash = window.location.hash.replace(/^#/, "");
  if (!/(access_token|error_description)=/.test(hash)) return null;
  const params = new URLSearchParams(hash);
  // Tira os tokens do endereço antes de qualquer coisa (não ficam no histórico nem em prints).
  window.history.replaceState(null, "", window.location.pathname + window.location.search);

  const errorText = params.get("error_description");
  if (errorText) {
    const expired = /expired|invalid/i.test(errorText);
    return { error: expired ? "Este link expirou ou já foi usado. Peça um novo." : describeAuthError(errorText) };
  }
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return null;

  const user = (await authRequest("user", undefined, access_token, "GET")) as unknown as SupabaseUser;
  const expiresIn = Number(params.get("expires_in"));
  const session: SupabaseSession = {
    access_token,
    refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600),
    user,
  };
  storeSession(session);
  return { session, type: params.get("type") ?? "" };
}

/**
 * Links da API própria: /confirmar-email#token=… e /redefinir-senha#token=…
 * O fragmento não vai para logs do proxy. O ?token= antigo continua aceito para links já enviados.
 * O token sai da barra de endereço antes da chamada de rede.
 */
async function readApiAuthRedirect(): Promise<RedirectResult> {
  const path = window.location.pathname.replace(/\/+$/, "");
  const hashToken = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token");
  const token = hashToken ?? new URLSearchParams(window.location.search).get("token");
  if (!token) return null;
  if (path.endsWith("/confirmar-email")) {
    clearAuthLinkFromUrl();
    return { session: await confirmEmailWithToken(token), type: "signup" };
  }
  if (path.endsWith("/redefinir-senha")) {
    clearAuthLinkFromUrl();
    return { resetToken: token, type: "recovery" };
  }
  return null;
}

function clearAuthLinkFromUrl(): void {
  window.history.replaceState(null, "", "/");
}

/** Envia o e-mail de "esqueci minha senha"; o link volta para o site com type=recovery. */
export async function requestPasswordReset(email: string): Promise<void> {
  if (apiEnabled) {
    await apiRequest("/api/v1/auth/forgot-password", { method: "POST", body: { email } });
    return;
  }
  const redirect = encodeURIComponent(window.location.origin);
  await authRequest(`recover?redirect_to=${redirect}`, { email });
}

/**
 * Confere o link de recuperação antes de pedir a senha nova. `false`: o token expirou ou já foi
 * usado. Falha de rede e API antiga sem o endpoint não bloqueiam (o envio ainda confere).
 */
export async function validateResetToken(token: string): Promise<boolean> {
  if (!apiEnabled) return false;
  try {
    await apiRequest("/api/v1/auth/reset-password/validate", { method: "POST", body: { token } });
    return true;
  } catch (error) {
    if (error instanceof ApiHttpError && error.status === 400) return false;
    return true;
  }
}

/** Define a senha nova pelo link de recuperação (só a API própria usa token no endereço). */
export async function resetPasswordWithToken(token: string, password: string): Promise<void> {
  if (!apiEnabled) throw new Error("Este link de recuperação não é válido.");
  await apiRequest("/api/v1/auth/reset-password", {
    method: "POST",
    body: { token, password },
  });
}

/** Confirma o e-mail pelo link e já devolve a sessão (API própria). */
export async function confirmEmailWithToken(token: string): Promise<SupabaseSession> {
  if (!apiEnabled) throw new Error("Este link de confirmação não é válido.");
  const payload = await apiRequest<ApiAuthResponse>("/api/v1/auth/confirm-email", {
    method: "POST",
    body: { token },
  });
  const session = apiToSession(payload);
  storeSession(session);
  return session;
}

/** Troca a senha logado. Na API própria, exige a senha atual e derruba as outras sessões. */
export async function updatePassword(
  session: SupabaseSession,
  currentPassword: string,
  password: string,
): Promise<void> {
  if (apiEnabled) {
    await apiRequest("/api/v1/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword: password },
      accessToken: session.access_token,
    });
    return;
  }
  await authRequest("user", { password }, session.access_token, "PUT");
}

/** Nome e avatar do perfil (ficam em user_metadata na conta; o avatar é só um id, sem imagem). */
export async function updateProfileData(
  session: SupabaseSession,
  data: { name?: string; avatar?: string | null; photo?: string | null; cover?: string | null },
): Promise<SupabaseSession> {
  if (apiEnabled) {
    const user = await apiRequest<ApiUser>("/api/v1/auth/profile", {
      method: "PATCH",
      body: data,
      accessToken: session.access_token,
    });
    const next = { ...session, user: { ...session.user, ...apiToUser(user) } };
    storeSession(next, false);
    return next;
  }
  const user = (await authRequest("user", { data }, session.access_token, "PUT")) as unknown as SupabaseUser;
  const next = { ...session, user: { ...session.user, ...user } };
  storeSession(next, false);
  return next;
}

/**
 * Perfil atual da conta no servidor. A sessão guarda uma cópia do perfil; sem isto, o nome ou a
 * foto trocados em outro aparelho só apareceriam aqui ao entrar de novo. Devolve a mesma sessão
 * se nada mudou.
 */
export async function refreshProfile(session: SupabaseSession): Promise<SupabaseSession> {
  if (apiEnabled) {
    const current = await apiRequest<ApiUser>("/api/v1/auth/me", { accessToken: session.access_token });
    if (!current?.id || current.id !== session.user.id) return session;
    const user = apiToUser(current);
    if (
      JSON.stringify(user.user_metadata ?? {}) === JSON.stringify(session.user.user_metadata ?? {}) &&
      user.email === session.user.email
    ) {
      return session;
    }
    const base = storedAuthSession();
    if (!base) return session;
    if (base.user.id !== session.user.id) return session;
    const next = { ...base, user: { ...base.user, ...user } };
    storeSession(next, false);
    return next;
  }
  const user = (await authRequest("user", undefined, session.access_token, "GET")) as unknown as SupabaseUser;
  if (!user?.id || user.id !== session.user.id) return session;
  if (JSON.stringify(user.user_metadata ?? {}) === JSON.stringify(session.user.user_metadata ?? {}) && user.email === session.user.email) {
    return session;
  }
  // Pela sessão guardada: se ela foi renovada enquanto isto rodava, não volta o token antigo.
  const base = storedAuthSession();
  if (!base) return session;
  if (base.user.id !== session.user.id) return session;
  const next = { ...base, user: { ...base.user, ...user } };
  storeSession(next, false);
  return next;
}

let restoreSessionRequest:Promise<SupabaseSession | null> | null = null;

export function restoreAuthSession(): Promise<SupabaseSession | null> {
  if (!restoreSessionRequest) {
    restoreSessionRequest = restoreAuthSessionOnce().finally(() => {
      restoreSessionRequest = null;
    });
  }
  return restoreSessionRequest;
}

export async function signOut(session: SupabaseSession): Promise<void> {
  // Sempre invalida a geração local; isso impede que uma renovação em voo ressuscite a sessão.
  storeSession(null);
  if (apiEnabled) {
    try {
      localStorage.setItem(LOGOUT_PENDING_KEY, "1");
    } catch {
      // Sem armazenamento: o logout local ainda vale nesta aba.
    }
    try {
      await apiRequest("/api/v1/auth/logout", {
        method: "POST",
        body: {},
        accessToken: session.access_token,
      });
      try {
        localStorage.removeItem(LOGOUT_PENDING_KEY);
      } catch {
        // Sem armazenamento.
      }
    } catch {
      // Sem rede: a próxima abertura tenta revogar o cookie antes de restaurar a sessão.
    }
    return;
  }
  await authRequest("logout", undefined, session.access_token);
}

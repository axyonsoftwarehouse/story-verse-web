/**
 * O login só existe com o Supabase configurado. Sem as variáveis (ex.: deploy que ainda não as
 * tem), o app funciona como antes, sem contas — o merge não quebra a produção.
 */
export const authEnabled = Boolean(
  import.meta.env.VITE_SUPABASE_URL?.trim() && import.meta.env.VITE_SUPABASE_ANON_KEY?.trim(),
);
/** Conta obrigatória para ler e importar. `VITE_LOGIN_REQUIRED=false` deixa a conta opcional. */
export const loginRequired = authEnabled && import.meta.env.VITE_LOGIN_REQUIRED?.trim() !== "false";

const SESSION_KEY = "storyverse:supabase-session";
const LEGACY_AUTH_KEY = "storyverse:auth";
export const EMAIL_OTP_ENABLED = import.meta.env.VITE_SUPABASE_EMAIL_OTP_ENABLED === "true";

export type SupabaseUser = {
  id: string;
  email: string;
  created_at?: string;
  user_metadata?: Record<string, unknown>;
};

export type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: SupabaseUser;
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
  if (normalized.includes("password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
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

/**
 * Sem internet (ou Supabase fora do ar). Diferente de "senha errada" ou "sessão revogada": nesse
 * caso a sessão guardada continua valendo no aparelho, e a renovação é tentada de novo depois.
 */
export class AuthNetworkError extends Error {}

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
  } catch {
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
    throw new AuthNetworkError(describeAuthError(serverMessage || "too many requests"));
  }
  // Supabase fora do ar também não é motivo para deslogar.
  if (response.status >= 500) {
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

function storeSession(session: SupabaseSession | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

export function clearLegacyCredentials() {
  localStorage.removeItem(LEGACY_AUTH_KEY);
}

export async function signInWithPassword(email: string, password: string): Promise<SupabaseSession> {
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
  const payload = await authRequest("verify", { type: "signup", email, token });
  const session = makeSession(payload);
  if (!session) throw new Error("Código confirmado, mas o serviço não retornou uma sessão válida.");
  storeSession(session);
  return session;
}

export async function resendSignupCode(email: string): Promise<void> {
  await authRequest("resend", { type: "signup", email });
}

/** Sessão guardada neste aparelho (pode ter sido renovada por outra aba). */
export function storedAuthSession(): SupabaseSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SupabaseSession) : null;
  } catch {
    return null;
  }
}

export async function refreshAuthSession(refreshToken: string): Promise<SupabaseSession> {
  const payload = await authRequest("token?grant_type=refresh_token", { refresh_token: refreshToken });
  const session = makeSession(payload);
  if (!session) throw new Error("Não foi possível renovar a sessão. Entre novamente.");
  storeSession(session);
  return session;
}

async function restoreAuthSessionOnce(): Promise<SupabaseSession | null> {
  clearLegacyCredentials();
  const stored = localStorage.getItem(SESSION_KEY);
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
      return await refreshAuthSession(session.refresh_token);
    } catch (error) {
      // Sem internet (app instalado, lendo offline): continua logado com a sessão guardada e
      // renova quando a conexão voltar. Só sai se o Supabase recusar a sessão.
      if (error instanceof AuthNetworkError) return session;
      storeSession(null);
      throw error;
    }
  }
  return session;
}

/**
 * Link do e-mail (confirmação de cadastro ou "esqueci minha senha"): o Supabase volta para o
 * site com a sessão no endereço (#access_token=…&refresh_token=…&type=signup|recovery). Aqui ela
 * vira a sessão do app e sai da barra de endereço.
 */
type RedirectResult = { session: SupabaseSession; type: string } | { error: string } | null;
let redirectResult: Promise<RedirectResult> | null = null;

/** Lê o link uma vez só por carregamento (o React em desenvolvimento roda os efeitos duas vezes). */
export function consumeAuthRedirect(): Promise<RedirectResult> {
  redirectResult ??= readAuthRedirect();
  return redirectResult;
}

async function readAuthRedirect(): Promise<RedirectResult> {
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

/** Envia o e-mail de "esqueci minha senha"; o link volta para o site com type=recovery. */
export async function requestPasswordReset(email: string): Promise<void> {
  const redirect = encodeURIComponent(window.location.origin);
  await authRequest(`recover?redirect_to=${redirect}`, { email });
}

/** Define a senha nova (logado pelo link de recuperação). */
export async function updatePassword(session: SupabaseSession, password: string): Promise<void> {
  await authRequest("user", { password }, session.access_token, "PUT");
}

/** Nome e avatar do perfil (ficam em user_metadata na conta; o avatar é só um id, sem imagem). */
export async function updateProfileData(
  session: SupabaseSession,
  data: { name?: string; avatar?: string | null; photo?: string | null; cover?: string | null },
): Promise<SupabaseSession> {
  const user = (await authRequest("user", { data }, session.access_token, "PUT")) as unknown as SupabaseUser;
  const next = { ...session, user: { ...session.user, ...user } };
  storeSession(next);
  return next;
}

/**
 * Perfil atual da conta no servidor. A sessão guarda uma cópia do perfil; sem isto, o nome ou a
 * foto trocados em outro aparelho só apareceriam aqui ao entrar de novo. Devolve a mesma sessão
 * se nada mudou.
 */
export async function refreshProfile(session: SupabaseSession): Promise<SupabaseSession> {
  const user = (await authRequest("user", undefined, session.access_token, "GET")) as unknown as SupabaseUser;
  if (!user?.id || user.id !== session.user.id) return session;
  if (JSON.stringify(user.user_metadata ?? {}) === JSON.stringify(session.user.user_metadata ?? {}) && user.email === session.user.email) {
    return session;
  }
  // Pela sessão guardada: se ela foi renovada enquanto isto rodava, não volta o token antigo.
  const base = storedAuthSession() ?? session;
  if (base.user.id !== session.user.id) return session;
  const next = { ...base, user: { ...base.user, ...user } };
  storeSession(next);
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
  try {
    await authRequest("logout", undefined, session.access_token);
  } finally {
    storeSession(null);
  }
}

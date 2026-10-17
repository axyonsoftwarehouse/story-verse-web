import { captureError, captureEvent } from "./telemetry";

/**
 * Base da API própria (ex.: https://api.storyverse.2.29.42.104.sslip.io).
 * Sem `VITE_API_URL`, o app continua usando o Supabase (comportamento atual).
 */
export const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "");
export const apiEnabled = apiBaseUrl.length > 0;

/**
 * Sem internet (ou API/Supabase fora do ar). Diferente de "senha errada" ou "sessão revogada":
 * nesse caso a sessão guardada continua valendo no aparelho e a renovação é tentada depois.
 */
export class AuthNetworkError extends Error {}

/**
 * A sessão mudou ou foi encerrada em outra aba. Diferente de falha de rede: não é transitória,
 * então não deve ser tratada como "offline" nem tentar de novo com o token antigo.
 */
export class AuthSessionError extends Error {}

type ApiInit = { method?: string; body?: unknown; accessToken?: string; keepalive?: boolean; timeoutMs?: number };

/** Chamada JSON à API própria. `path` começa em "/api/v1/". */
export async function apiRequest<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { method = "GET", body, accessToken, keepalive, timeoutMs = 10_000 } = init;
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      keepalive,
      // Rede muito lenta não pode prender o app na tela de abertura.
      signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(timeoutMs) : undefined,
    });
  } catch (error) {
    captureError("api-network", error, { path });
    throw new AuthNetworkError("Não foi possível conectar ao serviço. Verifique sua conexão.");
  }

  const payload = (await response.json().catch(() => ({}))) as { error?: string } & Record<string, unknown>;
  const serverMessage = typeof payload.error === "string" ? payload.error : "";

  // Instabilidade (5xx) ou limite (429): não desloga ninguém; tenta de novo depois.
  if (response.status === 429 || response.status >= 500) {
    captureEvent("warn", "api-http", `API respondeu ${response.status}`, { path });
    throw new AuthNetworkError(serverMessage || "O serviço está instável. Tente de novo em instantes.");
  }
  if (!response.ok) {
    throw new Error(serverMessage || "Falha na requisição.");
  }
  return payload as T;
}

/** Fetch cru (arquivos em binário). `path` começa em "/api/v1/". Não trata o status. */
export async function apiFetch(
  path: string,
  init: { method?: string; body?: BodyInit; headers?: Record<string, string>; accessToken?: string } = {},
): Promise<Response> {
  try {
    return await fetch(`${apiBaseUrl}${path}`, {
      method: init.method ?? "GET",
      headers: {
        ...(init.accessToken ? { Authorization: `Bearer ${init.accessToken}` } : {}),
        ...init.headers,
      },
      body: init.body,
      signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(60_000) : undefined,
    });
  } catch (error) {
    captureError("api-network", error, { path });
    throw new AuthNetworkError("Sem conexão com o servidor. Tente de novo.");
  }
}

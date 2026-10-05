import { AuthNetworkError, supabaseConfig, type SupabaseSession } from "./auth";

/**
 * Chamada a uma função do banco (Supabase RPC) em nome de quem está logado. `feature` dá nome
 * ao recurso na mensagem de "ainda não foi configurado" (ex.: "O ranking", "A loja").
 */
export async function rpc<T>(
  session: SupabaseSession,
  name: string,
  args: object,
  opts: { feature: string; keepalive?: boolean },
): Promise<T> {
  const { url, anonKey } = supabaseConfig();
  let res: Response;
  try {
    res = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      keepalive: opts.keepalive,
      signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(20_000) : undefined,
    });
  } catch {
    throw new AuthNetworkError("Sem conexão com o servidor. Tente de novo.");
  }
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { message?: string; msg?: string; error?: string };
    const message = payload.message ?? payload.msg ?? payload.error ?? `Erro ${res.status}`;
    // A mensagem da tela é amigável; a original fica no console para diagnóstico.
    console.warn(`[rpc] ${name} → ${res.status}: ${message}`);
    const m = message.toLowerCase();
    if (m.includes("could not find the function") || m.includes("does not exist") || res.status === 404) {
      throw new Error(`${opts.feature} ainda não foi configurado no Supabase.`);
    }
    if (res.status === 401) throw new Error("Sua sessão expirou. Entre de novo.");
    throw new Error(message);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

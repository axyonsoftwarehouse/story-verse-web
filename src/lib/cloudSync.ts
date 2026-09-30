import { AuthNetworkError, supabaseConfig, type SupabaseSession } from "./auth";
import { isUserKey } from "./dataOwner";

/**
 * Dados de leitura da conta na nuvem (tabela reading_state, ver supabase/reading-state.sql):
 * progresso, marcações, conversas, sequência, minutos, terminados e preferências. Assim nada se
 * perde ao reinstalar o app ou trocar de aparelho. (Os arquivos dos livros importados continuam
 * só no aparelho: são grandes demais.)
 *
 * Ao entrar, junta nuvem + aparelho sem apagar nada; depois envia a cada 30 s se algo mudou e ao
 * sair do app. Só envia depois de baixar a nuvem — um aparelho novo e vazio nunca apaga o que já
 * estava guardado.
 */

type Snapshot = Record<string, string>;

const PUSH_EVERY_MS = 30_000;

function localSnapshot(): Snapshot {
  const out: Snapshot = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && isUserKey(k)) out[k] = localStorage.getItem(k) ?? "";
    }
  } catch {
    // Sem armazenamento.
  }
  return out;
}

function parse<T>(raw: string | undefined): T | undefined {
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

type Stamped = { updatedAt?: number; finishedAt?: number };

/** Junta dois valores da mesma chave sem perder nada (regra por tipo de dado). */
function mergeKey(key: string, local: string | undefined, remote: string | undefined): string | undefined {
  if (local === undefined) return remote;
  if (remote === undefined || local === remote) return local;
  const l = parse<unknown>(local);
  const r = parse<unknown>(remote);
  if (l === undefined) return remote;
  if (r === undefined) return local;

  // Progresso: por livro, fica o lido mais recentemente.
  if (key === "storyverse:reading-progress") {
    const a = l as Record<string, Stamped>;
    const b = r as Record<string, Stamped>;
    const out: Record<string, Stamped> = { ...b };
    for (const [id, p] of Object.entries(a)) if (!out[id] || (p.updatedAt ?? 0) >= (out[id].updatedAt ?? 0)) out[id] = p;
    return JSON.stringify(out);
  }
  // Minutos por dia: o maior dos dois.
  if (key === "storyverse:reading-stats") {
    const a = l as Record<string, number>;
    const b = r as Record<string, number>;
    const out = { ...b };
    for (const [d, s] of Object.entries(a)) out[d] = Math.max(s, out[d] ?? 0);
    return JSON.stringify(out);
  }
  // Escudos: o maior; dias salvos por escudo: todos.
  if (key === "storyverse:streak-meta") {
    const a = l as { shields?: number; frozen?: string[]; awardedAt?: number; shieldNoticeDay?: string };
    const b = r as typeof a;
    return JSON.stringify({
      ...b,
      ...a,
      shields: Math.max(a.shields ?? 0, b.shields ?? 0),
      frozen: [...new Set([...(b.frozen ?? []), ...(a.frozen ?? [])])],
      awardedAt: Math.max(a.awardedAt ?? 0, b.awardedAt ?? 0),
    });
  }
  // Terminados: todos, com a primeira data.
  if (key === "storyverse:finished-books") {
    const a = l as Record<string, Stamped>;
    const b = r as Record<string, Stamped>;
    const out: Record<string, Stamped> = { ...b };
    for (const [id, f] of Object.entries(a)) if (!out[id] || (f.finishedAt ?? 0) < (out[id].finishedAt ?? 0)) out[id] = f;
    return JSON.stringify(out);
  }
  // Marcações de um livro: todas (pelo id).
  if (key.startsWith("storyverse:highlights:")) {
    const byId = new Map<string, { id: string }>();
    for (const h of [...(r as { id: string }[]), ...(l as { id: string }[])]) if (h?.id) byId.set(h.id, h);
    return JSON.stringify([...byId.values()]);
  }
  // Conversa de um livro: a mais recente.
  if (key.startsWith("storyverse:chat:") && key !== "storyverse:chat-index") {
    return ((l as Stamped).updatedAt ?? 0) >= ((r as Stamped).updatedAt ?? 0) ? local : remote;
  }
  if (key === "storyverse:chat-index") {
    return JSON.stringify([...new Set([...(l as string[]), ...(r as string[])])]);
  }
  // Preferências (tema, meta, lembrete, voz…): vale a deste aparelho.
  return local;
}

function merge(local: Snapshot, remote: Snapshot): Snapshot {
  const out: Snapshot = {};
  for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    if (!isUserKey(k)) continue;
    const v = mergeKey(k, local[k], remote[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

async function rest(session: SupabaseSession, path: string, init: { method?: string; body?: string; headers?: Record<string, string>; keepalive?: boolean } = {}) {
  const { url, anonKey } = supabaseConfig();
  let res: Response;
  try {
    res = await fetch(`${url}/rest/v1/${path}`, {
      method: init.method ?? "GET",
      headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", ...init.headers },
      body: init.body,
      keepalive: init.keepalive,
    });
  } catch {
    throw new AuthNetworkError("Sem conexão para sincronizar.");
  }
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { message?: string };
    console.warn(`[sync] ${init.method ?? "GET"} ${path.split("?")[0]} → ${res.status}: ${payload.message ?? ""}`);
    throw new Error(payload.message ?? `Erro ${res.status}`);
  }
  return res;
}

let lastPushed = "";
let pulledFor: string | null = null;

/**
 * Baixa os dados da nuvem e junta com os do aparelho. Devolve true se algo mudou aqui
 * (a tela precisa ler de novo). Depois disso o envio fica liberado.
 */
export async function pullAndMerge(session: SupabaseSession): Promise<boolean> {
  const res = await rest(session, `reading_state?select=data&user_id=eq.${session.user.id}`);
  const rows = (await res.json()) as { data: Snapshot }[];
  const remote = rows[0]?.data ?? {};
  const local = localSnapshot();
  const merged = merge(local, remote);
  let changed = false;
  try {
    for (const [k, v] of Object.entries(merged)) {
      if (local[k] !== v) {
        localStorage.setItem(k, v);
        changed = true;
      }
    }
  } catch {
    // Sem espaço: fica com o que coube.
  }
  pulledFor = session.user.id;
  // Nuvem sem os dados daqui (primeira vez ou outro aparelho mexeu): envia já.
  lastPushed = JSON.stringify(remote);
  return changed;
}

/** Envia o estado atual se mudou desde o último envio (só depois de baixar a nuvem). */
export async function pushIfChanged(session: SupabaseSession, opts: { keepalive?: boolean } = {}): Promise<void> {
  if (pulledFor !== session.user.id) return;
  const data = localSnapshot();
  const body = JSON.stringify(data);
  if (body === lastPushed) return;
  await rest(session, "reading_state?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ user_id: session.user.id, data, updated_at: new Date().toISOString() }),
    keepalive: opts.keepalive && body.length < 60_000,
  });
  lastPushed = body;
}

/** Envio periódico e ao sair do app. Devolve a função para parar. */
export function startAutoPush(getSession: () => SupabaseSession | null): () => void {
  const tick = () => {
    const s = getSession();
    if (s) void pushIfChanged(s).catch(() => {});
  };
  const timer = window.setInterval(tick, PUSH_EVERY_MS);
  const flush = () => {
    const s = getSession();
    if (s) void pushIfChanged(s, { keepalive: true }).catch(() => {});
  };
  const onVisibility = () => document.visibilityState === "hidden" && flush();
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", flush);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", flush);
  };
}

/** Ao sair da conta: esquece o estado do envio (a próxima conta baixa a própria nuvem antes). */
export function resetSync() {
  pulledFor = null;
  lastPushed = "";
}

import { AuthNetworkError, supabaseConfig, type SupabaseSession } from "./auth";
import { currentDataOwner, isUserKey } from "./dataOwner";

/**
 * Dados de leitura da conta na nuvem (tabela reading_state, ver supabase/reading-state.sql):
 * progresso, marcações, conversas, sequência, minutos, terminados, livros importados (a lista;
 * os arquivos vão por bookSync.ts) e preferências. É a mesma conta na Web e no app instalado:
 * o que muda num aparece no outro.
 *
 * Cada sincronização baixa a nuvem, junta com o aparelho e grava de volta só se a nuvem não
 * mudou no meio do caminho (senão baixa de novo e junta outra vez) — dois aparelhos abertos ao
 * mesmo tempo nunca apagam o que o outro gravou.
 *
 * A junção é em 3 vias: compara aparelho e nuvem com a última versão em que os dois
 * concordavam (a "base", guardada neste aparelho). Só o lado que mudou vale; assim a
 * preferência trocada na Web chega ao celular e o que foi apagado num lado some no outro.
 * Quando os dois lados mudaram a mesma coisa, cada tipo de dado tem a sua regra (abaixo).
 *
 * Roda ao entrar, a cada 30 s com o app na tela, ao voltar para o app, ao voltar a internet e
 * ao sair do app. Sempre baixa antes de gravar — um aparelho novo e vazio nunca apaga a nuvem.
 */

type Snapshot = Record<string, string>;

const SYNC_EVERY_MS = 30_000;
const BASE_PREFIX = "storyverse:sync-base:";

/** Chaves juntadas item por item (a base guarda o valor inteiro; são pequenas). */
function mergesByItem(key: string): boolean {
  return (
    key === "storyverse:reading-progress" ||
    key === "storyverse:finished-books" ||
    key === "storyverse:library" ||
    key === "storyverse:chat-index" ||
    key.startsWith("storyverse:highlights:")
  );
}

/** Resumo curto de um texto (a base das conversas guarda só isso, para não dobrar o espaço). */
function digest(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `#${(h2 >>> 0).toString(36)}${(h1 >>> 0).toString(36)}:${s.length}`;
}

function toBase(snapshot: Snapshot): Snapshot {
  const out: Snapshot = {};
  for (const [k, v] of Object.entries(snapshot)) out[k] = mergesByItem(k) ? v : digest(v);
  return out;
}

function sameAsBase(key: string, value: string | undefined, base: string | undefined): boolean {
  if (value === undefined || base === undefined) return value === base;
  return mergesByItem(key) ? value === base : digest(value) === base;
}

function loadBase(userId: string): Snapshot {
  try {
    return JSON.parse(localStorage.getItem(BASE_PREFIX + userId) ?? "{}") as Snapshot;
  } catch {
    return {};
  }
}

function saveBase(userId: string, snapshot: Snapshot) {
  try {
    localStorage.setItem(BASE_PREFIX + userId, JSON.stringify(toBase(snapshot)));
  } catch {
    // Sem espaço: a próxima junção trata tudo como mudado dos dois lados (não perde nada).
  }
}

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

type Stamped = { updatedAt?: number; finishedAt?: number; importedAt?: number; deletedAt?: number };

/**
 * Junta dois mapas item por item em 3 vias: item que só um lado mexeu (inclusive apagou) fica
 * como esse lado deixou; mexido nos dois, decide `pick`.
 */
function mergeItems<T>(
  local: Record<string, T>,
  remote: Record<string, T>,
  base: Record<string, T>,
  pick: (l: T, r: T) => T,
): Record<string, T> {
  const out: Record<string, T> = {};
  const same = (a: T | undefined, b: T | undefined) => JSON.stringify(a) === JSON.stringify(b);
  for (const id of new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(base)])) {
    const l = local[id];
    const r = remote[id];
    const b = base[id];
    let v: T | undefined;
    if (same(l, r)) v = l;
    else if (same(l, b)) v = r;
    else if (same(r, b)) v = l;
    // Apagado de um lado e mudado do outro: fica a mudança.
    else if (l === undefined) v = r;
    else if (r === undefined) v = l;
    else v = pick(l, r);
    if (v !== undefined) out[id] = v;
  }
  return out;
}

const byId = <T extends { id: string }>(list: T[] | undefined): Record<string, T> =>
  Object.fromEntries((list ?? []).filter((x) => x?.id).map((x) => [x.id, x]));
const asSet = (list: string[] | undefined): Record<string, true> => Object.fromEntries((list ?? []).map((x) => [x, true]));

/** Junta os dois valores de uma chave que mudou nos dois lados desde a última sincronização. */
function mergeKey(key: string, local: string, remote: string, base: string | undefined): string {
  const l = parse<unknown>(local);
  const r = parse<unknown>(remote);
  if (l === undefined) return remote;
  if (r === undefined) return local;
  const b = mergesByItem(key) ? parse<unknown>(base) : undefined;

  // Progresso: por livro, fica o lido mais recentemente.
  if (key === "storyverse:reading-progress") {
    const out = mergeItems(l as Record<string, Stamped>, r as Record<string, Stamped>, (b ?? {}) as Record<string, Stamped>, (x, y) =>
      (x.updatedAt ?? 0) >= (y.updatedAt ?? 0) ? x : y,
    );
    return JSON.stringify(out);
  }
  // Terminados: com a primeira data.
  if (key === "storyverse:finished-books") {
    const out = mergeItems(l as Record<string, Stamped>, r as Record<string, Stamped>, (b ?? {}) as Record<string, Stamped>, (x, y) =>
      (x.finishedAt ?? 0) <= (y.finishedAt ?? 0) ? x : y,
    );
    return JSON.stringify(out);
  }
  // Livros importados: vale o que aconteceu por último (importar de novo ou remover).
  if (key === "storyverse:library") {
    const when = (e: Stamped) => Math.max(e.deletedAt ?? 0, e.importedAt ?? 0);
    const out = mergeItems(l as Record<string, Stamped>, r as Record<string, Stamped>, (b ?? {}) as Record<string, Stamped>, (x, y) =>
      when(x) >= when(y) ? { ...y, ...x } : { ...x, ...y },
    );
    return JSON.stringify(out);
  }
  // Marcações de um livro: pelo id (a removida num lado some no outro).
  if (key.startsWith("storyverse:highlights:")) {
    const lm = byId(l as { id: string }[]);
    const out = mergeItems(lm, byId(r as { id: string }[]), byId(b as { id: string }[] | undefined), (x) => x);
    // Na ordem em que estavam aqui; as novas do outro aparelho no fim.
    const order = [...Object.keys(lm), ...Object.keys(out)];
    return JSON.stringify([...new Set(order)].filter((id) => out[id]).map((id) => out[id]));
  }
  if (key === "storyverse:chat-index") {
    const out = mergeItems(asSet(l as string[]), asSet(r as string[]), asSet(b as string[] | undefined), () => true as const);
    return JSON.stringify(Object.keys(out));
  }
  // Conversa de um livro: a mais recente.
  if (key.startsWith("storyverse:chat:")) {
    return ((l as Stamped).updatedAt ?? 0) >= ((r as Stamped).updatedAt ?? 0) ? local : remote;
  }
  // Minutos por dia: o maior dos dois.
  if (key === "storyverse:reading-stats") {
    const a = l as Record<string, number>;
    const out = { ...(r as Record<string, number>) };
    for (const [d, s] of Object.entries(a)) out[d] = Math.max(s, out[d] ?? 0);
    return JSON.stringify(out);
  }
  // Escudos: o maior; dias salvos por escudo: todos.
  if (key === "storyverse:streak-meta") {
    const a = l as { shields?: number; frozen?: string[]; awardedAt?: number; shieldNoticeDay?: string };
    const c = r as typeof a;
    return JSON.stringify({
      ...c,
      ...a,
      shields: Math.max(a.shields ?? 0, c.shields ?? 0),
      frozen: [...new Set([...(c.frozen ?? []), ...(a.frozen ?? [])])],
      awardedAt: Math.max(a.awardedAt ?? 0, c.awardedAt ?? 0),
    });
  }
  // Preferências (tema, meta, lembrete, voz…) mudadas nos dois ao mesmo tempo: vale a daqui.
  return local;
}

/** Junta aparelho e nuvem em 3 vias (ver o topo do arquivo). */
function merge(local: Snapshot, remote: Snapshot, base: Snapshot): Snapshot {
  const out: Snapshot = {};
  for (const k of new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(base)])) {
    if (!isUserKey(k)) continue;
    const l = local[k];
    const r = remote[k];
    let v: string | undefined;
    if (l === r) v = l;
    else if (sameAsBase(k, l, base[k])) v = r;
    else if (sameAsBase(k, r, base[k])) v = l;
    else if (l === undefined) v = r;
    else if (r === undefined) v = l;
    else v = mergeKey(k, l, r, base[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

const sameSnapshot = (a: Snapshot, b: Snapshot) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);

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
  if (!res.ok && res.status !== 409) {
    const payload = (await res.json().catch(() => ({}))) as { message?: string };
    console.warn(`[sync] ${init.method ?? "GET"} ${path.split("?")[0]} → ${res.status}: ${payload.message ?? ""}`);
    throw new Error(payload.message ?? `Erro ${res.status}`);
  }
  return res;
}

type Row = { data: Snapshot; updated_at: string };

/**
 * Grava `data` só se a nuvem ainda estiver como foi lida (`prev`). Devolve false se outro
 * aparelho gravou antes — aí é preciso baixar e juntar de novo.
 */
async function writeIfUnchanged(session: SupabaseSession, prev: Row | undefined, data: Snapshot, keepalive: boolean): Promise<boolean> {
  const body = JSON.stringify({ user_id: session.user.id, data, updated_at: new Date().toISOString() });
  const opts = { keepalive: keepalive && body.length < 60_000 };
  if (!prev) {
    // Primeira gravação da conta: se outro aparelho criou a linha antes, dá 409.
    const res = await rest(session, "reading_state", { method: "POST", headers: { Prefer: "return=minimal" }, body, ...opts });
    return res.status !== 409;
  }
  const res = await rest(session, `reading_state?user_id=eq.${session.user.id}&updated_at=eq.${encodeURIComponent(prev.updated_at)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body,
    ...opts,
  });
  if (keepalive) return true;
  const rows = (await res.json().catch(() => [])) as unknown[];
  return rows.length > 0;
}

let running: { userId: string; promise: Promise<boolean> } | null = null;

async function syncOnce(session: SupabaseSession, keepalive: boolean): Promise<boolean> {
  const userId = session.user.id;
  let changed = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await rest(session, `reading_state?select=data,updated_at&user_id=eq.${userId}`);
    const row = ((await res.json()) as Row[])[0];
    const remote = row?.data ?? {};
    // Os dados em uso aqui são de outra conta (saiu ou trocou enquanto baixava): não mistura.
    if (currentDataOwner() !== userId) return false;
    // Lê o aparelho só agora (depois da rede), sem pausa até gravar: nada que a pessoa fez
    // enquanto a nuvem baixava fica de fora.
    const local = localSnapshot();
    const merged = merge(local, remote, loadBase(userId));
    try {
      for (const k of Object.keys(local)) {
        if (!(k in merged)) {
          localStorage.removeItem(k);
          changed = true;
        }
      }
      for (const [k, v] of Object.entries(merged)) {
        if (local[k] !== v) {
          localStorage.setItem(k, v);
          changed = true;
        }
      }
    } catch {
      // Sem espaço: fica com o que coube (a próxima rodada tenta de novo).
    }
    if (sameSnapshot(merged, remote)) {
      saveBase(userId, merged);
      return changed;
    }
    const written = await writeIfUnchanged(session, row, merged, keepalive);
    // Ao sair do app não dá para saber se gravou: a base fica como estava e a próxima rodada
    // junta de novo (se gravou, nada muda; se não, nada se perde).
    if (written && !keepalive) saveBase(userId, merged);
    if (written) return changed;
  }
  return changed;
}

/**
 * Baixa a nuvem, junta com o aparelho e envia o resultado. Devolve true se algo mudou aqui
 * (a tela precisa ler de novo). Chamadas ao mesmo tempo esperam a que já está rodando.
 */
export function syncNow(session: SupabaseSession, opts: { keepalive?: boolean } = {}): Promise<boolean> {
  const userId = session.user.id;
  if (running?.userId === userId) return running.promise;
  const promise = syncOnce(session, opts.keepalive ?? false).finally(() => {
    if (running?.promise === promise) running = null;
  });
  running = { userId, promise };
  return promise;
}

/**
 * Sincroniza a cada 30 s com o app na tela, ao voltar para ele, ao voltar a internet e ao sair.
 * `sync` faz a rodada (dados e livros) e devolve true se chegou algo do outro aparelho; aí
 * `onRemoteChange` atualiza a tela. Devolve a função para parar.
 */
export function startAutoSync(
  getSession: () => SupabaseSession | null,
  sync: (session: SupabaseSession, opts: { keepalive: boolean; resume: boolean }) => Promise<boolean>,
  onRemoteChange: (reason: "interval" | "resume") => void,
): () => void {
  const run = (reason: "interval" | "resume", keepalive = false) => {
    const s = getSession();
    if (!s) return;
    void sync(s, { keepalive, resume: reason === "resume" })
      .then((changed) => changed && !keepalive && onRemoteChange(reason))
      .catch(() => {});
  };
  const timer = window.setInterval(() => document.visibilityState === "visible" && run("interval"), SYNC_EVERY_MS);
  const onVisibility = () => (document.visibilityState === "hidden" ? run("interval", true) : run("resume"));
  const onHide = () => run("interval", true);
  const onOnline = () => run("resume");
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onHide);
  window.addEventListener("online", onOnline);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onHide);
    window.removeEventListener("online", onOnline);
  };
}

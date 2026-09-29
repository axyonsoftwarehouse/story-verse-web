import type { Ebook } from "../data/types";
import { AuthNetworkError, supabaseConfig, type SupabaseSession } from "./auth";
import { castFromNames } from "./cast";

/**
 * Acervo da comunidade (Supabase): leitores enviam o texto de um livro com a declaração de
 * direitos, o admin aprova e ele aparece para todos. As regras de quem vê, envia e aprova estão
 * no banco (supabase/community-books.sql), não só na tela.
 */

export type Rights = "public_domain" | "own_work" | "free_license";

export const RIGHTS_OPTIONS: { id: Rights; label: string; hint: string; placeholder: string }[] = [
  {
    id: "public_domain",
    label: "É domínio público",
    hint: "O autor morreu há mais de 70 anos (ex.: Machado de Assis, Alencar, Eça).",
    placeholder: "Ex.: Aluísio Azevedo morreu em 1913",
  },
  {
    id: "own_work",
    label: "Sou o autor",
    hint: "O livro é seu e você quer divulgá-lo aqui.",
    placeholder: "Ex.: link do seu perfil de autor ou da obra",
  },
  {
    id: "free_license",
    label: "Tem licença livre",
    hint: "Creative Commons ou outra licença que permita redistribuir.",
    placeholder: "Ex.: CC BY 4.0 — link da licença",
  },
];

export function rightsLabel(r: Rights): string {
  return RIGHTS_OPTIONS.find((o) => o.id === r)?.label ?? r;
}

export type Submission = {
  id: string;
  user_id: string;
  submitter_name: string | null;
  title: string;
  author: string | null;
  language: "pt" | "en";
  rights: Rights;
  rights_note: string | null;
  characters: string | null;
  text_path: string;
  char_count: number | null;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

const BUCKET = "community-books";
/** Mesmo limite do bucket no Supabase. */
export const MAX_COMMUNITY_BYTES = 10 * 1024 * 1024;

function friendly(message: string, status: number): string {
  const m = message.toLowerCase();
  if ((m.includes("relation") && m.includes("does not exist")) || m.includes("bucket not found") || m.includes("could not find the table")) {
    return "O acervo da comunidade ainda não foi configurado no Supabase.";
  }
  if (m.includes("row-level security") || m.includes("permission") || status === 403) return "Sem permissão para fazer isso.";
  if (m.includes("payload too large") || m.includes("exceeded the maximum") || status === 413) {
    return "O texto do livro é grande demais (máximo de 10 MB).";
  }
  if (status === 401) return "Sua sessão expirou. Entre de novo.";
  return message;
}

async function sb(
  path: string,
  init: { method?: string; body?: BodyInit; headers?: Record<string, string>; session?: SupabaseSession | null } = {},
): Promise<Response> {
  const { url, anonKey } = supabaseConfig();
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, {
      method: init.method ?? "GET",
      headers: {
        apikey: anonKey,
        // Sem sessão vai só a chave pública (a chave nova sb_publishable_ não é um token).
        ...(init.session ? { Authorization: `Bearer ${init.session.access_token}` } : {}),
        ...init.headers,
      },
      body: init.body,
      signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(30_000) : undefined,
    });
  } catch {
    throw new AuthNetworkError("Sem conexão com o servidor. Tente de novo.");
  }
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { message?: string; msg?: string; error?: string };
    const message = payload.message ?? payload.msg ?? payload.error ?? `Erro ${res.status}`;
    // A mensagem da tela é amigável; a original fica no console para diagnóstico.
    console.warn(`[acervo] ${init.method ?? "GET"} ${path.split("?")[0]} → ${res.status}: ${message}`);
    throw new Error(friendly(message, res.status));
  }
  return res;
}

const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

/** Número estável para o livro (progresso, traduções e elenco usam `gutenbergId`). */
function numericId(uuid: string): number {
  let h = 0;
  for (const ch of uuid) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 1_000_000_000 + (h % 900_000_000);
}

export function submissionToEbook(s: Submission): Ebook {
  const characters = s.characters ? castFromNames(s.title, s.characters) : [];
  return {
    id: `cm-${s.id}`,
    gutenbergId: numericId(s.id),
    title: s.title,
    author: s.author || "Autor não informado",
    genre: "Da comunidade",
    textLanguage: s.language,
    source: "community",
    communityPath: s.text_path,
    ...(characters.length > 0 ? { characters } : {}),
  };
}

export async function submitBook(
  session: SupabaseSession,
  input: {
    title: string;
    author: string;
    language: "pt" | "en";
    rights: Rights;
    rightsNote: string;
    characters: string;
    submitterName: string;
    text: string;
  },
): Promise<Submission> {
  const bytes = new Blob([input.text]).size;
  if (bytes > MAX_COMMUNITY_BYTES) throw new Error("O texto do livro é grande demais (máximo de 10 MB).");
  const path = `${session.user.id}/${crypto.randomUUID()}.txt`;
  await sb(`/storage/v1/object/${BUCKET}/${encodePath(path)}`, {
    method: "POST",
    session,
    // Exatamente o tipo aceito pelo bucket (com ";charset" o Supabase pode recusar).
    headers: { "Content-Type": "text/plain" },
    body: input.text,
  });
  try {
    const res = await sb("/rest/v1/book_submissions", {
      method: "POST",
      session,
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: session.user.id,
        submitter_name: input.submitterName.slice(0, 60),
        title: input.title.slice(0, 120),
        author: input.author.slice(0, 120) || null,
        language: input.language,
        rights: input.rights,
        rights_note: input.rightsNote.trim().slice(0, 500) || null,
        characters: input.characters.trim().slice(0, 600) || null,
        text_path: path,
        char_count: input.text.length,
      }),
    });
    const [row] = (await res.json()) as Submission[];
    approvedCache = null;
    return row;
  } catch (err) {
    // Sem o registro, o arquivo não serve para nada.
    void sb(`/storage/v1/object/${BUCKET}/${encodePath(path)}`, { method: "DELETE", session }).catch(() => {});
    throw err;
  }
}

export async function listSubmissions(
  session: SupabaseSession | null,
  which: "mine" | "pending" | "approved",
): Promise<Submission[]> {
  const query =
    which === "mine"
      ? `user_id=eq.${session?.user.id ?? ""}&order=created_at.desc`
      : which === "pending"
        ? "status=eq.pending&order=created_at.asc"
        : "status=eq.approved&order=reviewed_at.desc.nullslast";
  const res = await sb(`/rest/v1/book_submissions?select=*&${query}`, { session });
  return (await res.json()) as Submission[];
}

let approvedCache: { key: string; books: Promise<Ebook[]> } | null = null;

/** Livros aprovados (estante "Da comunidade"). Guardado por sessão para não buscar a cada tela. */
export function approvedCommunityBooks(session: SupabaseSession | null): Promise<Ebook[]> {
  const key = session?.user.id ?? "anon";
  if (approvedCache?.key !== key) {
    const books = listSubmissions(session, "approved").then((rows) => rows.map(submissionToEbook));
    books.catch(() => {
      approvedCache = null;
    });
    approvedCache = { key, books };
  }
  return approvedCache.books;
}

export async function reviewSubmission(
  session: SupabaseSession,
  id: string,
  status: "approved" | "rejected",
  note?: string,
): Promise<Submission> {
  const res = await sb(`/rest/v1/book_submissions?id=eq.${id}`, {
    method: "PATCH",
    session,
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ status, review_note: note?.trim().slice(0, 500) || null, reviewed_at: new Date().toISOString() }),
  });
  const rows = (await res.json()) as Submission[];
  // Sem linha de volta = a regra do banco não deixou (não é admin).
  if (rows.length === 0) throw new Error("Sem permissão para revisar envios.");
  approvedCache = null;
  return rows[0];
}

/** Apaga o envio e o arquivo (admin: qualquer um; quem enviou: só os em análise). */
export async function deleteSubmission(session: SupabaseSession, s: Submission): Promise<void> {
  await sb(`/rest/v1/book_submissions?id=eq.${s.id}`, { method: "DELETE", session });
  await sb(`/storage/v1/object/${BUCKET}/${encodePath(s.text_path)}`, { method: "DELETE", session }).catch(() => {});
  approvedCache = null;
}

export async function fetchCommunityText(session: SupabaseSession | null, path: string): Promise<string> {
  const res = await sb(`/storage/v1/object/authenticated/${BUCKET}/${encodePath(path)}`, { session });
  return res.text();
}

/** Pergunta ao banco (função is_admin); qualquer erro conta como "não é admin". */
export async function checkIsAdmin(session: SupabaseSession): Promise<boolean> {
  try {
    const res = await sb("/rest/v1/rpc/is_admin", {
      method: "POST",
      session,
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    return (await res.json()) === true;
  } catch {
    return false;
  }
}

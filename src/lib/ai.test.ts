import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_API_URL", "https://api.example.test");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** Responde como a API de IA e guarda o corpo enviado para /ai/reply. */
function captureAiRequest() {
  let sent: { system: string } | null = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/v1/ai/status")) return new Response(JSON.stringify({ live: true }), { status: 200 });
      if (url.endsWith("/api/v1/ai/reply")) {
        sent = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ text: "Olá, leitor." }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    }),
  );
  return () => sent;
}

const params = {
  character: { id: "capitu", name: "Capitu", role: "personagem", color: "#c9a88c", systemHint: "Você é Capitu." },
  history: [],
  userMessage: "O que achou?",
  ebookTitle: "Dom Casmurro",
  textExcerpt: "Trecho.",
  readingProgressPct: 100,
  textLanguage: "pt" as const,
};

describe("chat com contexto da estante", () => {
  it("o chat recebe status e nota do livro atual", async () => {
    const sent = captureAiRequest();
    const { characterReply } = await import("./ai");
    await characterReply({ ...params, shelf: { status: "finished", rating: 4.5 } });
    expect(sent()?.system).toContain("Para este livro o leitor marcou: terminado, nota 4,5 de 5.");
  });

  it("sem estante o prompt continua como antes", async () => {
    const sent = captureAiRequest();
    const { characterReply } = await import("./ai");
    await characterReply(params);
    expect(sent()?.system).not.toContain("Para este livro o leitor marcou");
  });

  it("status sem nota", async () => {
    const sent = captureAiRequest();
    const { characterReply } = await import("./ai");
    await characterReply({ ...params, shelf: { status: "abandoned", rating: null } });
    expect(sent()?.system).toContain("Para este livro o leitor marcou: abandonado.");
  });
});

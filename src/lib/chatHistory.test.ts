import { afterEach, describe, expect, it } from "vitest";
import { forgetAllChats, loadChat, saveChat, storedChatSummary } from "./chatHistory";

afterEach(() => localStorage.clear());

const msg = (id: string, role: "user" | "assistant") => ({ id, role, text: id });

describe("histórico de conversas na Central de Privacidade", () => {
  it("resume o que está guardado e apaga tudo", () => {
    saveChat("livro-a", { capitu: [msg("1", "user"), msg("2", "assistant"), msg("3", "user")] }, "capitu");
    saveChat("livro-b", { bento: [msg("4", "user")] }, "bento");
    expect(storedChatSummary()).toEqual({ books: 2, messages: 3 });

    forgetAllChats();

    expect(storedChatSummary()).toEqual({ books: 0, messages: 0 });
    expect(loadChat("livro-a")).toBeNull();
    expect(loadChat("livro-b")).toBeNull();
  });
});

describe("conversa guardada com mensagens automáticas antigas", () => {
  it("abre sem as mensagens de capítulo que enchiam o histórico", () => {
    saveChat(
      "livro-c",
      {
        colton: [
          { id: "1", role: "assistant", text: "Começamos “Capítulo 42”. Leia com calma, estou aqui se quiser conversar." },
          { id: "2", role: "user", text: "Oi, Colton" },
          { id: "3", role: "assistant", text: "Oi! Que bom te ver." },
        ],
      },
      "colton",
    );
    expect(loadChat("livro-c")?.threads.colton.map((m) => m.id)).toEqual(["2", "3"]);
  });
});

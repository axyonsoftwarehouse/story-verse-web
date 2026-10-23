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

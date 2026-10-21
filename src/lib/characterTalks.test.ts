import { beforeEach, describe, expect, it } from "vitest";
import { characterTalks, saveChat, type ChatMsg } from "./chatHistory";

const msg = (role: ChatMsg["role"], i: number): ChatMsg => ({ id: `${role}-${i}`, role, text: "oi" });

beforeEach(() => localStorage.clear());

describe("characterTalks", () => {
  it("conta só as suas mensagens, de todos os livros, do mais conversado ao menos", () => {
    saveChat("livro-a", { capitu: [msg("user", 1), msg("assistant", 2), msg("user", 3)], bento: [msg("user", 4)] }, "capitu");
    saveChat("livro-b", { holmes: [msg("assistant", 5)], watson: [msg("user", 6), msg("user", 7), msg("user", 8)] }, "watson");
    expect(characterTalks().map((t) => [t.bookId, t.characterId, t.sent])).toEqual([
      ["livro-b", "watson", 3],
      ["livro-a", "capitu", 2],
      ["livro-a", "bento", 1],
    ]);
  });

  it("sem conversas, lista vazia", () => {
    expect(characterTalks()).toEqual([]);
  });
});

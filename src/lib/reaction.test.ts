import { describe, expect, it } from "vitest";
import { splitReaction } from "./ai";

describe("splitReaction", () => {
  it("tira a marca do texto e devolve o emoji", () => {
    expect(splitReaction("[reação: 😂] Você me pegou nessa!")).toEqual({ text: "Você me pegou nessa!", reaction: "😂" });
  });

  it("aceita a marca sem acento e no fim da fala", () => {
    expect(splitReaction("Que gentil da sua parte. [reacao:💛]")).toEqual({ text: "Que gentil da sua parte.", reaction: "💛" });
  });

  it("ignora emoji fora da lista, mas ainda limpa a marca", () => {
    expect(splitReaction("[reação: 🔥] Pois é.")).toEqual({ text: "Pois é.", reaction: null });
  });

  it("sem marca, o texto fica como está", () => {
    expect(splitReaction("Pergunte o que quiser.")).toEqual({ text: "Pergunte o que quiser.", reaction: null });
  });
});

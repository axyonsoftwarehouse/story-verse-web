import { describe, expect, it } from "vitest";
import { naturalizeReply } from "./naturalSpeech";

describe("naturalizeReply", () => {
  it("remove o nome do personagem no início", () => {
    expect(naturalizeReply("Isaura: Eu tenho medo.", ["Isaura"])).toBe("Eu tenho medo.");
  });

  it("tira as aspas que envolvem a fala inteira", () => {
    expect(naturalizeReply('"Olá, leitor"')).toBe("Olá, leitor.");
  });

  it("transforma lista em enumeração falada", () => {
    expect(naturalizeReply("- Ler\n- Cantar\n- Ser livre")).toBe("Ler, Cantar e ser livre.");
  });

  it("remove ações entre asteriscos no começo da fala", () => {
    expect(naturalizeReply("*sorri* Claro que sim.")).toBe("Claro que sim.");
  });

  it("remove travessão de diálogo e troca travessão no meio por vírgula", () => {
    expect(naturalizeReply("— Você me entende?")).toBe("Você me entende?");
    expect(naturalizeReply("Eu fui — e voltei.")).toBe("Eu fui, e voltei.");
  });
});

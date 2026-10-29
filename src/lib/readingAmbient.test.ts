import { describe, expect, it } from "vitest";
import { isAmbientMessage, missYouMessage, tidyAmbientMessages } from "./readingAmbient";

const user = (text: string) => ({ role: "user", text });
const bot = (text: string) => ({ role: "assistant", text });

describe("mensagens automáticas do personagem", () => {
  it("reconhece as frases de saudade com qualquer capítulo", () => {
    for (let d = 0; d < 4; d++) expect(isAmbientMessage(missYouMessage("Capítulo 51", d))).toBe(true);
    expect(isAmbientMessage("Que bom que você voltou! Gostei da pergunta.")).toBe(false);
  });

  it("tira as mensagens de capítulo que não são mais geradas", () => {
    const msgs = [
      bot("Oi! Sou o Colton."),
      bot("Começamos “Capítulo 42”. Leia com calma, estou aqui se quiser conversar."),
      bot("Você já passou da metade deste capítulo. Alguma coisa te chamou a atenção até aqui?"),
      user("Quem é você de verdade?"),
      bot("Começamos “Capítulo 44”. Leia com calma, estou aqui se quiser conversar."),
    ];
    expect(tidyAmbientMessages(msgs)).toEqual([bot("Oi! Sou o Colton."), user("Quem é você de verdade?")]);
  });

  it("de várias saudades seguidas sem resposta, deixa só a última", () => {
    const msgs = [
      user("Oi"),
      bot(missYouMessage("Capítulo 3", 2)),
      bot("Começamos “Capítulo 4”. Leia com calma, estou aqui se quiser conversar."),
      bot(missYouMessage("Capítulo 5", 3)),
    ];
    expect(tidyAmbientMessages(msgs)).toEqual([user("Oi"), bot(missYouMessage("Capítulo 5", 3))]);
  });

  it("mantém a saudade que o leitor respondeu", () => {
    const msgs = [bot(missYouMessage("Capítulo 3", 2)), user("Voltei!"), bot(missYouMessage("Capítulo 9", 4))];
    expect(tidyAmbientMessages(msgs)).toEqual(msgs);
  });
});

import { describe, expect, it } from "vitest";
import { chatBackground, hotAuthors, isJumboEmoji } from "./groupHelpers";

describe("chatBackground", () => {
  it("sem fundo escolhido usa o padrão", () => {
    expect(chatBackground(null)).toEqual({ className: "" });
  });

  it("tema pronto vira classe; tema desconhecido cai no padrão", () => {
    expect(chatBackground("preset:floresta")).toEqual({ className: "chat-bg-floresta" });
    expect(chatBackground("preset:inventado")).toEqual({ className: "" });
  });

  it("imagem enviada vai como variável CSS, sem quebrar as aspas", () => {
    const bg = chatBackground('https://api.example/x"y.webp');
    expect(bg.className).toBe("chat-bg-image");
    expect(bg.style).toEqual({ "--chat-image": 'url("https://api.example/x%22y.webp")' });
  });
});

describe("isJumboEmoji", () => {
  it("de 1 a 3 emojis, com tom de pele e família", () => {
    expect(isJumboEmoji("😂")).toBe(true);
    expect(isJumboEmoji(" ❤️🔥 ")).toBe(true);
    expect(isJumboEmoji("👍🏽")).toBe(true);
    expect(isJumboEmoji("👨‍👩‍👧")).toBe(true);
  });

  it("texto, números ou emojis demais ficam no balão", () => {
    expect(isJumboEmoji("oi 😂")).toBe(false);
    expect(isJumboEmoji("😂😂😂😂")).toBe(false);
    expect(isJumboEmoji("123")).toBe(false);
    expect(isJumboEmoji("")).toBe(false);
    expect(isJumboEmoji(null)).toBe(false);
  });
});

describe("hotAuthors", () => {
  const now = Date.parse("2026-10-30T12:00:00Z");
  const day = 86_400_000;
  const say = (author_id: string, n: number, ago = 0, extra = {}) =>
    Array.from({ length: n }, () => ({ author_id, created_at: new Date(now - ago).toISOString(), ...extra }));

  it("as até 3 pessoas que mais falaram na semana, com o mínimo de mensagens", () => {
    const hot = hotAuthors([...say("ana", 9), ...say("bia", 7), ...say("caio", 6), ...say("duda", 5), ...say("eva", 4)], now);
    expect([...hot]).toEqual(["ana", "bia", "caio"]);
  });

  it("não conta mensagens antigas, apagadas ou ainda não enviadas", () => {
    const hot = hotAuthors(
      [...say("ana", 8, 8 * day), ...say("bia", 6, 0, { deleted: true }), ...say("caio", 6, 0, { pending: true }), ...say("duda", 5, 2 * day)],
      now,
    );
    expect([...hot]).toEqual(["duda"]);
  });
});

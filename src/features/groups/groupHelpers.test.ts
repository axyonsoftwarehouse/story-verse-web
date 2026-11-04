import { describe, expect, it } from "vitest";
import { chatBackground, isJumboEmoji } from "./groupHelpers";

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

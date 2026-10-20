import { beforeEach, describe, expect, it } from "vitest";
import {
  applyServerQuota,
  countMessage,
  dailyMessageLimit,
  DEFAULT_DAILY_MESSAGE_LIMIT,
  extraMessages,
  messagesLeftToday,
} from "./usageLimit";

beforeEach(() => {
  localStorage.clear();
});

describe("quota de mensagens", () => {
  it("usa o restante devolvido pelo servidor", () => {
    applyServerQuota(7, 30);
    expect(messagesLeftToday()).toBe(7);
    expect(dailyMessageLimit()).toBe(30);
  });

  it("mantém créditos extras separados da cota gratuita", () => {
    applyServerQuota(0, 50, 3);
    expect(messagesLeftToday()).toBe(0);
    expect(extraMessages()).toBe(3);
  });

  it("o contador local não sobrescreve o valor do servidor", () => {
    applyServerQuota(1, 50);
    expect(countMessage()).toBe(1);
    applyServerQuota(0, 50);
    expect(messagesLeftToday()).toBe(0);
  });

  it("sem resposta do servidor, cai no limite local padrão", () => {
    expect(dailyMessageLimit()).toBe(DEFAULT_DAILY_MESSAGE_LIMIT);
    expect(messagesLeftToday()).toBe(DEFAULT_DAILY_MESSAGE_LIMIT);
    expect(countMessage()).toBe(DEFAULT_DAILY_MESSAGE_LIMIT - 1);
  });
});

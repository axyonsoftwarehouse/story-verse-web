import { describe, expect, it } from "vitest";
import { canEditMessage, EDIT_WINDOW_MS, type GroupMessage } from "../../lib/groups";

const now = Date.parse("2026-11-12T12:00:00Z");
const base: GroupMessage = {
  id: 1,
  group_id: "g",
  author_id: "eu",
  author_name: "Eu",
  author_avatar: "",
  body: "*abre a porta*",
  spoiler_chapter: null,
  reply_to: null,
  created_at: new Date(now - 60_000).toISOString(),
  deleted: false,
  hidden: false,
  reactions: [],
  kind: "user",
};

describe("canEditMessage", () => {
  it("a própria mensagem de texto no roleplay, dentro do prazo", () => {
    expect(canEditMessage(base, "eu", true, now)).toBe(true);
  });

  it("fora do roleplay, de outra pessoa ou do narrador não", () => {
    expect(canEditMessage(base, "eu", false, now)).toBe(false);
    expect(canEditMessage(base, "outra", true, now)).toBe(false);
    expect(canEditMessage({ ...base, kind: "narrator" }, "eu", true, now)).toBe(false);
  });

  it("foto, áudio, apagada ou ainda enviando não", () => {
    expect(canEditMessage({ ...base, media_kind: "image" }, "eu", true, now)).toBe(false);
    expect(canEditMessage({ ...base, media_kind: "audio", body: null }, "eu", true, now)).toBe(false);
    expect(canEditMessage({ ...base, deleted: true }, "eu", true, now)).toBe(false);
    expect(canEditMessage({ ...base, pending: true }, "eu", true, now)).toBe(false);
  });

  it("passou de 24 horas não", () => {
    const old = { ...base, created_at: new Date(now - EDIT_WINDOW_MS - 1000).toISOString() };
    expect(canEditMessage(old, "eu", true, now)).toBe(false);
  });
});

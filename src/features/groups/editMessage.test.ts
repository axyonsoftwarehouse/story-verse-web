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
  it("a própria mensagem de texto, dentro do prazo — no chat comum também", () => {
    expect(canEditMessage(base, "eu", now)).toBe(true);
  });

  it("de outra pessoa ou do narrador não", () => {
    expect(canEditMessage(base, "outra", now)).toBe(false);
    expect(canEditMessage({ ...base, kind: "narrator" }, "eu", now)).toBe(false);
  });

  it("foto, áudio, apagada ou ainda enviando não", () => {
    expect(canEditMessage({ ...base, media_kind: "image" }, "eu", now)).toBe(false);
    expect(canEditMessage({ ...base, media_kind: "audio", body: null }, "eu", now)).toBe(false);
    expect(canEditMessage({ ...base, deleted: true }, "eu", now)).toBe(false);
    expect(canEditMessage({ ...base, pending: true }, "eu", now)).toBe(false);
  });

  it("prazo de 7 dias: 6 dias depois ainda edita, 8 dias depois não", () => {
    expect(EDIT_WINDOW_MS).toBe(7 * 24 * 60 * 60 * 1000);
    const day = 24 * 60 * 60 * 1000;
    expect(canEditMessage({ ...base, created_at: new Date(now - 6 * day).toISOString() }, "eu", now)).toBe(true);
    expect(canEditMessage({ ...base, created_at: new Date(now - 8 * day).toISOString() }, "eu", now)).toBe(false);
  });
});

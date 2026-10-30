import { describe, expect, it } from "vitest";
import { applyReaction, mergeMessages, messageTime, parseSse, typingLabel, type GroupMessage } from "./groups";

function msg(id: number, extra: Partial<GroupMessage> = {}): GroupMessage {
  return {
    id,
    group_id: "g1",
    author_id: "u1",
    author_name: "Ana",
    author_avatar: "",
    body: `mensagem ${id}`,
    spoiler_chapter: null,
    reply_to: null,
    created_at: "2026-10-30T12:00:00Z",
    deleted: false,
    hidden: false,
    reactions: [],
    ...extra,
  };
}

describe("parseSse", () => {
  it("lê eventos completos e devolve o pedaço que ainda não terminou", () => {
    const seen: [string, string][] = [];
    const rest = parseSse('event:ready\ndata:{"ok":true}\n\n:ping\n\nevent:message\ndata:{"id":1}\n\nevent:mess', (n, d) =>
      seen.push([n, d]),
    );
    expect(seen).toEqual([
      ["ready", '{"ok":true}'],
      ["message", '{"id":1}'],
    ]);
    expect(rest).toBe("event:mess");
  });
});

describe("mergeMessages", () => {
  it("troca a mensagem provisória pela confirmada com o mesmo clientId", () => {
    const draft = msg(Number.MAX_SAFE_INTEGER, { client_id: "c1", pending: true });
    const merged = mergeMessages([msg(1), draft], [msg(2, { client_id: "c1" })]);
    expect(merged.map((m) => m.id)).toEqual([1, 2]);
    expect(merged.some((m) => m.pending)).toBe(false);
  });

  it("a confirmada fica com o clientId da provisória (a bolha não é recriada nem pisca)", () => {
    const draft = msg(Number.MAX_SAFE_INTEGER, { client_id: "c1", pending: true });
    const confirmed = mergeMessages([draft], [msg(2, { client_id: "c1" })]);
    expect(confirmed[0].client_id).toBe("c1");
    // O eco do tempo real sem clientId (API antiga) não troca a chave.
    expect(mergeMessages(confirmed, [msg(2, { client_id: undefined })])[0].client_id).toBe("c1");
  });

  it("não repete mensagem que chega pelo envio e pelo tempo real", () => {
    const merged = mergeMessages([msg(1)], [msg(2), msg(2)]);
    expect(merged.map((m) => m.id)).toEqual([1, 2]);
  });

  it("mantém as reações quando o evento chega sem elas", () => {
    const withReaction = msg(1, { reactions: [{ emoji: "🔥", count: 2, mine: true }] });
    expect(mergeMessages([withReaction], [msg(1)])[0].reactions).toHaveLength(1);
  });

  it("deixa as provisórias no fim e as antigas em ordem", () => {
    const draft = msg(Number.MAX_SAFE_INTEGER, { client_id: "c9", failed: true });
    expect(mergeMessages([draft, msg(5)], [msg(3)]).map((m) => m.id)).toEqual([3, 5, Number.MAX_SAFE_INTEGER]);
  });
});

describe("applyReaction", () => {
  it("soma, marca a minha e tira quando zera", () => {
    let m = applyReaction(msg(1), "👍", true, true);
    expect(m.reactions).toEqual([{ emoji: "👍", count: 1, mine: true }]);
    m = applyReaction(m, "👍", true, false);
    expect(m.reactions[0]).toEqual({ emoji: "👍", count: 2, mine: true });
    m = applyReaction(applyReaction(m, "👍", false, true), "👍", false, false);
    expect(m.reactions).toEqual([]);
  });
});

describe("messageTime", () => {
  it("mostra só a hora hoje e 'ontem' no dia anterior", () => {
    const now = new Date(2026, 9, 30, 15, 0);
    expect(messageTime(new Date(2026, 9, 30, 9, 5).toISOString(), now)).toBe("09:05");
    expect(messageTime(new Date(2026, 9, 29, 22, 10).toISOString(), now)).toBe("ontem 22:10");
    expect(messageTime(new Date(2026, 9, 12, 8, 0).toISOString(), now)).toMatch(/^12 out 08:00$/);
  });
});

describe("typingLabel", () => {
  it("junta os nomes de quem está digitando", () => {
    expect(typingLabel([])).toBe("");
    expect(typingLabel(["Ana"])).toBe("Ana está digitando…");
    expect(typingLabel(["Ana", "Bia"])).toBe("Ana e Bia estão digitando…");
    expect(typingLabel(["Ana", "Bia", "Caio"])).toBe("Ana e mais 2 estão digitando…");
  });
});

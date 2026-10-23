import { describe, expect, it } from "vitest";
import { canModerate, visibleSections } from "./adminSections";

describe("seções do admin", () => {
  it("mostra só o que o papel pode ver, na ordem do painel", () => {
    expect(visibleSections([]).map((s) => s.id)).toEqual([]);
    expect(visibleSections(["support"]).map((s) => s.id)).toEqual(["overview", "accounts", "forum"]);
    expect(visibleSections(["moderator"]).map((s) => s.id)).toEqual(["overview", "submissions", "forum"]);
    expect(visibleSections(["superadmin"]).map((s) => s.id)).toEqual([
      "overview",
      "accounts",
      "features",
      "submissions",
      "forum",
      "audit",
    ]);
    expect(visibleSections(["support", "moderator"]).map((s) => s.id)).toEqual([
      "overview",
      "accounts",
      "submissions",
      "forum",
    ]);
    expect(visibleSections(["leitor"]).map((s) => s.id)).toEqual([]);
    expect(canModerate(["support"])).toBe(false);
  });
});

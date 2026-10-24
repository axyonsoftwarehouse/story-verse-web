import { describe, expect, it } from "vitest";
import { canModerate, isSuperadmin, visibleSections } from "./adminSections";

describe("seções do admin", () => {
  it("mostra só o que o papel pode ver, na ordem do painel", () => {
    expect(visibleSections([]).map((s) => s.id)).toEqual([]);
    expect(visibleSections(["support"]).map((s) => s.id)).toEqual(["overview", "accounts", "forum"]);
    expect(visibleSections(["moderator"]).map((s) => s.id)).toEqual([
      "overview",
      "catalog",
      "forum",
    ]);
    expect(visibleSections(["superadmin"]).map((s) => s.id)).toEqual([
      "overview",
      "accounts",
      "features",
      "catalog",
      "forum",
      "billing",
      "audit",
    ]);
    expect(visibleSections(["support", "moderator"]).map((s) => s.id)).toEqual([
      "overview",
      "accounts",
      "catalog",
      "forum",
    ]);
    expect(visibleSections(["leitor"]).map((s) => s.id)).toEqual([]);
    expect(canModerate(["support"])).toBe(false);
    expect(canModerate(["moderator"])).toBe(true);
  });

  it("só o superadmin pode apagar do catálogo", () => {
    expect(isSuperadmin(["moderator"])).toBe(false);
    expect(isSuperadmin(["superadmin"])).toBe(true);
  });
});

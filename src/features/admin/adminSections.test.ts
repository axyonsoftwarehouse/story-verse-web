import { describe, expect, it } from "vitest";
import { canModerate, isSuperadmin, visibleSections } from "./adminSections";

describe("seções do admin", () => {
  it("mostra só o que o papel pode ver, na ordem do painel", () => {
    expect(visibleSections([]).map((s) => s.id)).toEqual([]);
    expect(visibleSections(["support"]).map((s) => s.id)).toEqual(["overview", "accounts", "sanctions", "forum", "groups"]);
    expect(visibleSections(["moderator"]).map((s) => s.id)).toEqual([
      "overview",
      "sanctions",
      "catalog",
      "forum",
      "groups",
    ]);
    expect(visibleSections(["superadmin"]).map((s) => s.id)).toEqual([
      "overview",
      "accounts",
      "sanctions",
      "features",
      "catalog",
      "forum",
      "groups",
      "metrics",
      "site",
      "billing",
      "audit",
    ]);
    expect(visibleSections(["support", "moderator"]).map((s) => s.id)).toEqual([
      "overview",
      "accounts",
      "sanctions",
      "catalog",
      "forum",
      "groups",
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

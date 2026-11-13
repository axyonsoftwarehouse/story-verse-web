import { describe, expect, it } from "vitest";
import { diamondEntryLabel, type DiamondEntry } from "./diamonds";

const entry = (over: Partial<DiamondEntry>): DiamondEntry => ({
  amount: -10,
  balance_after: 0,
  reason: "purchase",
  ref: "x",
  created_at: "2026-11-12T10:00:00Z",
  ...over,
});

describe("diamondEntryLabel", () => {
  it("compra com nome do item", () => {
    expect(diamondEntryLabel(entry({ item_name: "Folhas" }))).toBe("Compra: Folhas");
  });
  it("compra sem nome", () => {
    expect(diamondEntryLabel(entry({ item_name: null }))).toBe("Compra na loja");
    expect(diamondEntryLabel(entry({}))).toBe("Compra na loja");
  });
});

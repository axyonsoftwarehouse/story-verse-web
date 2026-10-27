import { describe, expect, it } from "vitest";
import { vitalRating } from "./adminVitals";

describe("vitalRating", () => {
  it("usa as faixas do Google para o p75, com o limite contando como bom", () => {
    expect(vitalRating("lcp", 2500)).toBe("good");
    expect(vitalRating("lcp", 2501)).toBe("needs-improvement");
    expect(vitalRating("lcp", 4000)).toBe("needs-improvement");
    expect(vitalRating("lcp", 4001)).toBe("poor");
    expect(vitalRating("inp", 200)).toBe("good");
    expect(vitalRating("inp", 350)).toBe("needs-improvement");
    expect(vitalRating("inp", 501)).toBe("poor");
    expect(vitalRating("cls", 0)).toBe("good");
    expect(vitalRating("cls", 0.1)).toBe("good");
    expect(vitalRating("cls", 0.2)).toBe("needs-improvement");
    expect(vitalRating("cls", 0.26)).toBe("poor");
  });
});

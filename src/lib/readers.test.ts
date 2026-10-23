import { describe, expect, it } from "vitest";
import { abbreviateCount, readersLabel } from "./readers";

describe("contador de leitores", () => {
  it("abrevia números grandes", () => {
    expect(abbreviateCount(0)).toBe("0");
    expect(abbreviateCount(999)).toBe("999");
    expect(abbreviateCount(1000)).toBe("1k");
    expect(abbreviateCount(1234)).toBe("1.2k");
    expect(abbreviateCount(9999)).toBe("9.9k");
    expect(abbreviateCount(15_400)).toBe("15k");
    expect(abbreviateCount(999_499)).toBe("999k");
    expect(abbreviateCount(999_999)).toBe("999k");
    expect(abbreviateCount(1_000_000)).toBe("1M");
    expect(abbreviateCount(2_340_000)).toBe("2.3M");
  });

  it("usa singular e plural", () => {
    expect(readersLabel(1)).toBe("1 leitor");
    expect(readersLabel(3)).toBe("3 leitores");
    expect(readersLabel(1200)).toBe("1.2k leitores");
  });
});

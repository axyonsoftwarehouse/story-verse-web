import { describe, expect, it } from "vitest";
import { communityTotals } from "./adminCommunity";

describe("communityTotals", () => {
  it("soma só os buckets dentro do intervalo, com as pontas inclusive", () => {
    const points = [
      { bucket: "2026-10-19", topics: 9, replies: 9, reports: 9 },
      { bucket: "2026-10-20", topics: 1, replies: 2, reports: 0 },
      { bucket: "2026-10-26", topics: 3, replies: 4, reports: 1 },
      { bucket: "2026-10-27", topics: 9, replies: 9, reports: 9 },
    ];
    expect(communityTotals(points, { from: "2026-10-20", to: "2026-10-26" })).toEqual({
      topics: 4,
      replies: 6,
      reports: 1,
    });
    expect(communityTotals([], { from: "2026-10-20", to: "2026-10-26" })).toEqual({
      topics: 0,
      replies: 0,
      reports: 0,
    });
  });
});

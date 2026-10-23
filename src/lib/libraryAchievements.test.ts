import { describe, expect, it } from "vitest";
import { e } from "../features/library/testEntry";
import { shelfAchievementInput } from "./libraryStore";

describe("números da estante para as conquistas", () => {
  it("conta notas, resenhas de 200+, gêneros terminados e terminados no ano", () => {
    const input = shelfAchievementInput(
      [
        e({ bookKey: "gb:1", status: "finished", finishedOn: "2026-02-01", genre: "Romance", rating: 5, review: "x".repeat(200) }),
        e({ bookKey: "gb:2", status: "finished", finishedOn: "2026-03-01", genre: "Terror", rating: 4, review: "curta" }),
        e({ bookKey: "cm:3", status: "finished", finishedOn: "2025-12-01", genre: "Da comunidade" }),
        e({ bookKey: "gb:4", status: "reading", genre: "Mistério" }),
      ],
      2026,
    );
    expect(input).toEqual({ ratings: 2, reviews: 1, genresFinished: 2, finishedThisYear: 2 });
  });
});

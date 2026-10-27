import { describe, expect, it } from "vitest";
import {
  change,
  fillDays,
  isoDate,
  latestCompleteD7,
  periodRanges,
  rangeEnding,
  ratio,
  shiftDays,
  signupsBetween,
} from "./dashboardMath";

describe("dashboardMath", () => {
  it("usa o dia de Brasília", () => {
    // 02:00 UTC ainda é o dia anterior em São Paulo.
    expect(isoDate(new Date("2026-10-26T02:00:00Z"))).toBe("2026-10-25");
  });

  it("anda pelos dias atravessando mês e ano", () => {
    expect(shiftDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("monta o período e o anterior de mesmo tamanho", () => {
    expect(rangeEnding("2026-10-26", 1)).toEqual({ from: "2026-10-26", to: "2026-10-26" });
    expect(periodRanges("2026-10-26", 7)).toEqual({
      current: { from: "2026-10-20", to: "2026-10-26" },
      previous: { from: "2026-10-13", to: "2026-10-19" },
    });
  });

  it("calcula a variação só quando há base", () => {
    expect(change(12, 10)).toBe(20);
    expect(change(5, 10)).toBe(-50);
    expect(change(3, 0)).toBeNull();
    expect(ratio(1, 4)).toBe(25);
    expect(ratio(1, 0)).toBeNull();
  });

  it("completa os dias sem leitura com zero", () => {
    const filled = fillDays(
      [{ bucket: "2026-10-25", activeReaders: 3, minutes: 40, booksStarted: 1, booksFinished: 0 }],
      { from: "2026-10-24", to: "2026-10-26" },
    );
    expect(filled.map((point) => [point.bucket, point.activeReaders])).toEqual([
      ["2026-10-24", 0],
      ["2026-10-25", 3],
      ["2026-10-26", 0],
    ]);
  });

  it("escolhe a coorte mais recente com D7 fechado", () => {
    const rows = [
      { cohortWeek: "2026-09-28", cohortSize: 10, d1: 5, d7: 3, d30: 1 },
      { cohortWeek: "2026-10-05", cohortSize: 8, d1: 4, d7: 2, d30: 0 },
      { cohortWeek: "2026-10-19", cohortSize: 6, d1: 2, d7: 0, d30: 0 },
    ];
    expect(latestCompleteD7(rows, "2026-10-26")?.cohortWeek).toBe("2026-10-05");
    expect(latestCompleteD7(rows.slice(2), "2026-10-26")).toBeNull();
  });

  it("soma os cadastros do intervalo e avisa quando a API não manda", () => {
    const points = [
      {
        bucket: "2026-10-24",
        activeReaders: 0,
        minutes: 0,
        booksStarted: 0,
        booksFinished: 0,
        signups: 2,
      },
      {
        bucket: "2026-10-25",
        activeReaders: 0,
        minutes: 0,
        booksStarted: 0,
        booksFinished: 0,
        signups: 3,
      },
      {
        bucket: "2026-10-26",
        activeReaders: 0,
        minutes: 0,
        booksStarted: 0,
        booksFinished: 0,
        signups: 5,
      },
    ];
    expect(signupsBetween(points, { from: "2026-10-25", to: "2026-10-26" })).toBe(8);
    expect(
      signupsBetween(
        [{ bucket: "2026-10-25", activeReaders: 1, minutes: 1, booksStarted: 0, booksFinished: 0 }],
        {
          from: "2026-10-25",
          to: "2026-10-25",
        },
      ),
    ).toBeNull();
  });
});

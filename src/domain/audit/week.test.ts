import { describe, expect, it } from "vitest";
import {
  REVIEW_NOTE_MAX,
  checkReviewNote,
  checkWeekToReview,
  weekEndOf,
  weekStartOf,
  weekText,
} from "./week";

describe("semana da revisão das exceções (spec 019, US3): segunda a domingo", () => {
  it("segunda da semana de cada dia", () => {
    expect(weekStartOf("2026-11-16")).toBe("2026-11-16"); // segunda
    expect(weekStartOf("2026-11-19")).toBe("2026-11-16"); // quinta
    expect(weekStartOf("2026-11-22")).toBe("2026-11-16"); // domingo
    expect(weekStartOf("2026-11-23")).toBe("2026-11-23");
    expect(weekStartOf("2027-01-02")).toBe("2026-12-28"); // vira o ano
    expect(weekStartOf("2028-03-01")).toBe("2028-02-28"); // ano bissexto
  });

  it("domingo do fim e o texto da semana", () => {
    expect(weekEndOf("2026-11-16")).toBe("2026-11-22");
    expect(weekEndOf("2026-12-28")).toBe("2027-01-03");
    expect(weekText("2026-11-16")).toBe("16/11 a 22/11");
    expect(weekText("2026-12-28")).toBe("28/12 a 03/01");
  });

  it("só revisa semana encerrada, pela segunda", () => {
    expect(checkWeekToReview("2026-11-16", "2026-11-23")).toEqual({ ok: true, value: "2026-11-16" });
    expect(checkWeekToReview("2026-11-09", "2026-11-28")).toEqual({ ok: true, value: "2026-11-09" });
    expect(checkWeekToReview("2026-11-16", "2026-11-22")).toEqual({
      ok: false,
      error: { code: "WEEK_NOT_CLOSED" },
    });
    expect(checkWeekToReview("2026-11-23", "2026-11-23")).toMatchObject({
      error: { code: "WEEK_NOT_CLOSED" },
    });
    for (const bad of ["2026-11-17", "2026-02-30", "x", "", "2026-11-16x"])
      expect(checkWeekToReview(bad, "2026-12-31"), bad).toEqual({
        ok: false,
        error: { code: "INVALID_WEEK" },
      });
  });

  it("observação opcional, até 140 letras", () => {
    expect(REVIEW_NOTE_MAX).toBe(140);
    expect(checkReviewNote("  conferi com o estoque  ")).toEqual({
      ok: true,
      value: "conferi com o estoque",
    });
    expect(checkReviewNote("   ")).toEqual({ ok: true, value: null });
    expect(checkReviewNote("é".repeat(140))).toEqual({ ok: true, value: "é".repeat(140) });
    expect(checkReviewNote("a".repeat(141))).toEqual({
      ok: false,
      error: { code: "NOTE_TOO_LONG", field: "note" },
    });
  });
});

import { describe, it, expect } from "vitest";
import { businessDay } from "./business-day";

describe("dia do restaurante (spec 009, número do pedido por dia)", () => {
  it("usa a data local no fuso do restaurante", () => {
    expect(businessDay(new Date("2026-11-08T15:00:00Z"), "America/Sao_Paulo")).toBe("2026-11-08");
  });

  it("23:30 em São Paulo ainda é o mesmo dia, mesmo já sendo o dia seguinte em UTC", () => {
    expect(businessDay(new Date("2026-11-09T02:30:00Z"), "America/Sao_Paulo")).toBe("2026-11-08");
  });

  it("00:10 em São Paulo já é o dia seguinte", () => {
    expect(businessDay(new Date("2026-11-09T03:10:00Z"), "America/Sao_Paulo")).toBe("2026-11-09");
  });
});

import { describe, it, expect } from "vitest";
import { pendingText, percent, sinceText, timeIn } from "./format";

describe("textos do caixa", () => {
  it("tempo desde a abertura em minutos, depois em horas", () => {
    const from = "2026-11-11T20:00:00.000Z";
    expect(sinceText(from, "2026-11-11T20:35:59.000Z")).toBe("há 35 min");
    expect(sinceText(from, "2026-11-11T21:00:00.000Z")).toBe("há 1 h");
    expect(sinceText(from, "2026-11-11T21:05:00.000Z")).toBe("há 1 h 05 min");
    // relógio do aparelho adiantado não dá tempo negativo
    expect(sinceText(from, "2026-11-11T19:59:00.000Z")).toBe("há 0 min");
  });

  it("pedidos pendentes no singular e no plural", () => {
    expect(pendingText(1)).toBe("1 pedido ainda não foi entregue");
    expect(pendingText(2)).toBe("2 pedidos ainda não foram entregues");
  });

  it("percentual com vírgula e sem zeros à toa", () => {
    expect(percent("10")).toBe("10%");
    expect(percent("12.5")).toBe("12,5%");
  });

  it("hora no fuso do restaurante", () => {
    expect(timeIn("2026-11-12T01:48:00.000Z", "America/Sao_Paulo")).toBe("22:48");
  });
});

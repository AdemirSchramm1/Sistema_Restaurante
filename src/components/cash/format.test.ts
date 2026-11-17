import { describe, it, expect } from "vitest";
import {
  atBy,
  countsText,
  dateIn,
  dayText,
  moneyField,
  openTabsText,
  outcomeText,
  parsedMoney,
  sinceWhen,
} from "./format";

const TZ = "America/Sao_Paulo";

describe("textos do caixa do dia (spec 014)", () => {
  it("resultado da conferência: Bateu, Sobra e Falta com o valor sem sinal (US4-3)", () => {
    expect(outcomeText("BALANCED", "0.00")).toBe("Bateu");
    expect(outcomeText("OVER", "3.00")).toBe("Sobra R$ 3,00");
    expect(outcomeText("SHORT", "-2.00")).toBe("Falta R$ 2,00");
  });

  it("contagens em ordem: 1ª contagem R$ 120,00 · 2ª contagem R$ 125,00 (US4-2)", () => {
    expect(countsText(["120.00", "125.00"])).toBe("1ª contagem R$ 120,00 · 2ª contagem R$ 125,00");
    expect(countsText(["125.00"])).toBe("1ª contagem R$ 125,00");
  });

  it("aviso das mesas com conta aberta, no singular e no plural (US4-5)", () => {
    expect(openTabsText(3)).toBe(
      "3 mesas ainda têm conta aberta. Os pagamentos delas vão entrar no próximo turno.",
    );
    expect(openTabsText(1)).toBe(
      "1 mesa ainda tem conta aberta. Os pagamentos dela vão entrar no próximo turno.",
    );
  });

  it("dia do restaurante e data no fuso", () => {
    expect(dayText("2026-11-17")).toBe("17/11/2026");
    expect(dateIn("2026-11-18T01:30:00.000Z", TZ)).toBe("17/11/2026");
  });

  it("desde quando o caixa está aberto: hoje só a hora, ontem e dias antes com o dia", () => {
    const now = "2026-11-17T15:00:00.000Z";
    expect(sinceWhen("2026-11-17T14:02:00.000Z", now, TZ)).toBe("11:02");
    expect(sinceWhen("2026-11-16T14:02:00.000Z", now, TZ)).toBe("ontem 11:02");
    expect(sinceWhen("2026-11-14T14:02:00.000Z", now, TZ)).toBe("14/11 11:02");
    // Virada do dia no fuso do restaurante, não no UTC: 01:30 UTC ainda é ontem à noite.
    expect(sinceWhen("2026-11-17T01:30:00.000Z", now, TZ)).toBe("ontem 22:30");
  });

  it("quando e quem: sem o nome, só a hora", () => {
    expect(atBy("2026-11-17T14:40:00.000Z", "Bruno", TZ)).toBe("às 11:40 por Bruno");
    expect(atBy("2026-11-17T14:40:00.000Z", null, TZ)).toBe("às 11:40");
  });

  it("campo de dinheiro: 150.00 vira 150,00 e o texto digitado vira decimal ou nada", () => {
    expect(moneyField("150.00")).toBe("150,00");
    expect(moneyField("1250.5")).toBe("1.250,50");
    expect(parsedMoney("125,00")?.toFixed(2)).toBe("125.00");
    expect(parsedMoney("R$ 1.250,50")?.toFixed(2)).toBe("1250.50");
    expect(parsedMoney("abc")).toBeNull();
    expect(parsedMoney("")).toBeNull();
  });
});

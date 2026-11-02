import { describe, it, expect } from "vitest";
import { applyPurchase, removePurchase } from "./average-cost";
import { d } from "../shared/decimal";

const s = (v: { toString(): string } | null) => v?.toString() ?? null;

describe("custo médio ponderado (docs/sistema/estoque/02-regras-de-calculo.md#custo-médio-ponderado)", () => {
  it("exemplo do manual: 10 un a R$ 20 + 20 un a R$ 25 = R$ 23,333…", () => {
    const avg = applyPurchase({ qty: d(10), avgCost: d(20) }, { qty: d(20), unitCost: d(25) });
    expect(avg.toDecimalPlaces(4).toString()).toBe("23.3333");
  });

  it("estoque zerado: vale o custo da compra", () => {
    expect(s(applyPurchase({ qty: d(0), avgCost: d(20) }, { qty: d(5), unitCost: d(10) }))).toBe("10");
    expect(s(applyPurchase({ qty: d(0), avgCost: null }, { qty: d(5), unitCost: d(10) }))).toBe("10");
  });

  it("saldo negativo antes da entrada: vale o custo da compra", () => {
    expect(s(applyPurchase({ qty: d(-2), avgCost: d(30) }, { qty: d(10), unitCost: d(5) }))).toBe("5");
  });

  it("compra de custo zero puxa a média para baixo", () => {
    expect(s(applyPurchase({ qty: d(10), avgCost: d(20) }, { qty: d(10), unitCost: d(0) }))).toBe("10");
  });

  it("estornar a compra devolve a média de antes", () => {
    const after = applyPurchase({ qty: d(10), avgCost: d(3) }, { qty: d(60), unitCost: d(4) });
    const back = removePurchase({ qty: d(70), avgCost: after }, { qty: d(60), unitCost: d(4) });
    expect(back.toDecimalPlaces(10).toString()).toBe("3");
  });

  it("estornar a compra que deixa o saldo zerado mantém a média", () => {
    expect(s(removePurchase({ qty: d(60), avgCost: d(4) }, { qty: d(60), unitCost: d(4) }))).toBe("4");
  });

  it("estorno que daria média negativa mantém a média", () => {
    expect(s(removePurchase({ qty: d(20), avgCost: d(1) }, { qty: d(10), unitCost: d(5) }))).toBe("1");
  });
});

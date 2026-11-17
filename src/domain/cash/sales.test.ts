import { describe, it, expect } from "vitest";
import { d } from "../shared/decimal";
import { salesShares } from "./sales";

const rows = (...r: [string, string][]) => r.map(([name, amount]) => ({ name, amount: d(amount) }));
const view = (r: ReturnType<typeof salesShares>) =>
  r.map((x) => [x.name, x.amount.toFixed(2), x.share.toFixed(1)]);

describe("parte de cada produto nas vendas (spec 014, US6-3)", () => {
  it("ordena do maior valor para o menor e calcula a parte sobre o total, sem mexer no valor", () => {
    expect(view(salesShares(rows(["Suco", "18.00"], ["X-Burger", "94.00"])))).toEqual([
      ["X-Burger", "94.00", "83.9"],
      ["Suco", "18.00", "16.1"],
    ]);
  });

  it("empate no valor desempata pelo nome", () => {
    expect(
      salesShares(rows(["Suco", "10.00"], ["Água", "10.00"], ["Café", "10.00"])).map((r) => r.name),
    ).toEqual(["Água", "Café", "Suco"]);
  });

  it("as partes com 1 casa somam 100,0%: o resto do arredondamento vai para o maior", () => {
    const shares = salesShares(rows(["A", "10.00"], ["B", "10.00"], ["C", "10.00"]));
    expect(shares.map((s) => s.share.toFixed(1))).toEqual(["33.4", "33.3", "33.3"]);
    const up = salesShares(
      rows(["A", "2.00"], ["B", "2.00"], ["C", "2.00"], ["D", "2.00"], ["E", "2.00"], ["F", "2.00"]),
    );
    expect(up.map((s) => s.share.toFixed(1))).toEqual(["16.5", "16.7", "16.7", "16.7", "16.7", "16.7"]);
    expect(up.reduce((a, s) => a.plus(s.share), d(0)).toFixed(1)).toBe("100.0");
  });

  it("total zero: partes zero, sem dividir por zero; lista vazia continua vazia", () => {
    expect(view(salesShares(rows(["Brinde", "0"])))).toEqual([["Brinde", "0.00", "0.0"]]);
    expect(salesShares([])).toEqual([]);
  });

  it("guarda os outros campos de cada linha", () => {
    const [first] = salesShares([{ name: "Suco", amount: d("9.00"), quantity: 1 }]);
    expect([first!.quantity, first!.share.toFixed(1)]).toEqual([1, "100.0"]);
  });
});

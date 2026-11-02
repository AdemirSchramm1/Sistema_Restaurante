import { describe, it, expect } from "vitest";
import { barPercents, parsePeriod, rankOutflow, type OutflowRow } from "./stock-report";
import { d } from "../shared/decimal";

const NOW = new Date("2026-11-02T12:00:00Z");

const row = (name: string, value: string, balance = "1"): OutflowRow => ({
  itemId: name,
  name,
  unit: "kg",
  quantity: d(value),
  value: d(value),
  balance: d(balance),
});

describe("período dos gráficos (spec 006, US3)", () => {
  it("aceita 7, 30 ou 90 dias e conta para trás a partir de agora", () => {
    const p = parsePeriod("7", NOW);
    expect(p.days).toBe(7);
    expect(p.from.toISOString()).toBe("2026-10-26T12:00:00.000Z");
    expect(p.to.toISOString()).toBe(NOW.toISOString());
    expect(parsePeriod("90", NOW).days).toBe(90);
  });

  it("qualquer outro valor vira 30 dias", () => {
    for (const v of [undefined, "", "15", "abc", "-7"]) expect(parsePeriod(v, NOW).days, String(v)).toBe(30);
  });
});

describe("itens que mais e menos saíram (spec 006, US3)", () => {
  const rows = [row("Tomate", "50"), row("Carne", "300"), row("Sal", "2"), row("Arroz", "0", "10"), row("Açúcar", "0", "0")];

  it("mais saíram: só quem saiu, do maior valor para o menor", () => {
    expect(rankOutflow(rows).most.map((r) => r.name)).toEqual(["Carne", "Tomate", "Sal"]);
  });

  it("menos saíram: parados com estoque primeiro, depois do menor valor para o maior", () => {
    const least = rankOutflow(rows).least;
    expect(least.map((r) => r.name)).toEqual(["Arroz", "Sal", "Tomate", "Carne"]);
    expect(least[0]!.stopped).toBe(true);
    expect(least[1]!.stopped).toBe(false);
  });

  it("item sem estoque e sem saída fica fora dos dois gráficos", () => {
    const { most, least } = rankOutflow(rows);
    expect([...most, ...least].some((r) => r.name === "Açúcar")).toBe(false);
  });

  it("limita a 10 por gráfico", () => {
    const many = Array.from({ length: 15 }, (_, i) => row(`Item ${i + 1}`, String(i + 1)));
    const { most, least } = rankOutflow(many);
    expect(most).toHaveLength(10);
    expect(most[0]!.name).toBe("Item 15");
    expect(least).toHaveLength(10);
    expect(least[0]!.name).toBe("Item 1");
  });

  it("empate fica em ordem alfabética", () => {
    expect(rankOutflow([row("Batata", "5"), row("Alho", "5")]).most.map((r) => r.name)).toEqual(["Alho", "Batata"]);
  });
});

describe("largura das barras (spec 006, FR-007)", () => {
  it("o maior valor ocupa 100% e os outros são proporcionais", () => {
    expect(barPercents([d(300), d(150), d(30)])).toEqual([100, 50, 10]);
  });

  it("valor pequeno ainda aparece (mínimo 2%) e zero fica sem barra", () => {
    expect(barPercents([d(1000), d(1), d(0)])).toEqual([100, 2, 0]);
  });

  it("tudo zero ou lista vazia não quebra", () => {
    expect(barPercents([d(0), d(0)])).toEqual([0, 0]);
    expect(barPercents([])).toEqual([]);
  });

  it("arredonda meio para cima só no fim", () => {
    expect(barPercents([d(3), d(1)])).toEqual([100, 33]);
    expect(barPercents([d(8), d(1)])).toEqual([100, 13]);
  });
});

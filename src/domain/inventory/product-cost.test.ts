import { describe, it, expect } from "vitest";
import {
  COST_BAND_LABELS,
  costBand,
  costBarPercent,
  costShare,
  evaluateProductCost,
  rankProductCosts,
  summarizeProductCosts,
  validateSalePrice,
  type ProductCostInput,
} from "./product-cost";
import { d } from "../shared/decimal";

/** X-Burger: pão R$ 1,00 + carne 150 g a R$ 40/kg (R$ 6,00) + queijo 30 g a R$ 50/kg (R$ 1,50). */
const xBurger = (over: Partial<ProductCostInput> = {}): ProductCostInput => ({
  id: "x",
  name: "X-Burger",
  salePrice: d("28.00"),
  cost: d("8.50"),
  lines: [
    { name: "Pão de hambúrguer", cost: d("1.00") },
    { name: "Carne moída", cost: d("6.00") },
    { name: "Queijo prato", cost: d("1.50") },
  ],
  missingCostNames: [],
  ...over,
});

describe("custo no preço (docs/produto/estoque/04-fichas-tecnicas.md#critérios-de-aceite-para-a-spec)", () => {
  it("é custo ÷ preço × 100, exato", () => {
    expect(costShare(d("8.50"), d("28.00")).toFixed(4)).toBe("30.3571");
    expect(costShare(d("3000"), d("10000")).toString()).toBe("30");
  });

  it("faixas do manual: até 35% dentro da faixa, até 40% atenção, acima de 40% alto (10-indicadores)", () => {
    expect(costBand(d("25"))).toBe("OK");
    expect(costBand(d("35"))).toBe("OK");
    expect(costBand(d("35.01"))).toBe("WARN");
    expect(costBand(d("40"))).toBe("WARN");
    expect(costBand(d("40.01"))).toBe("HIGH");
  });

  it("barra vai de 0 a 100% do preço, inteira, e fica cheia acima de 100%", () => {
    expect(costBarPercent(d("30.3571"))).toBe(30);
    expect(costBarPercent(d("42.5"))).toBe(43);
    expect(costBarPercent(d("130"))).toBe(100);
    expect(costBarPercent(d("0.2"))).toBe(1);
    expect(costBarPercent(d("0"))).toBe(0);
  });
});

describe("custo de um produto no painel (spec 008, US2)", () => {
  it("X-Burger a R$ 28,00: 30,4% dentro da faixa, sobra R$ 19,50 e a carne pesa mais", () => {
    const p = evaluateProductCost(xBurger());
    expect(p.share!.toFixed(1)).toBe("30.4");
    expect(p.band).toBe("OK");
    expect(p.margin!.toFixed(2)).toBe("19.50");
    expect(p.heaviest!.name).toBe("Carne moída");
    expect(p.heaviest!.cost.toFixed(2)).toBe("6.00");
    expect(p.heaviest!.share.toFixed(1)).toBe("70.6");
  });

  it("a R$ 20,00 fica alto (42,5%)", () => {
    const p = evaluateProductCost(xBurger({ salePrice: d("20.00") }));
    expect(p.share!.toString()).toBe("42.5");
    expect(p.band).toBe("HIGH");
  });

  it("vendido abaixo do custo tem sobra negativa (prejuízo)", () => {
    const p = evaluateProductCost(xBurger({ salePrice: d("8.00") }));
    expect(p.margin!.toFixed(2)).toBe("-0.50");
    expect(p.band).toBe("HIGH");
  });

  it("sem preço: sem %, sem faixa e sem sobra, mas mostra o que mais pesa", () => {
    const p = evaluateProductCost(xBurger({ salePrice: null }));
    expect(p.share).toBeNull();
    expect(p.band).toBeNull();
    expect(p.margin).toBeNull();
    expect(p.heaviest!.name).toBe("Carne moída");
  });

  it("sem custo: nada calculado", () => {
    const p = evaluateProductCost(
      xBurger({
        cost: null,
        lines: [
          { name: "Pão de hambúrguer", cost: d("1.00") },
          { name: "Carne moída", cost: null },
        ],
        missingCostNames: ["Carne moída"],
      }),
    );
    expect(p.share).toBeNull();
    expect(p.margin).toBeNull();
    expect(p.heaviest).toBeNull();
  });

  it("custo zero (só bonificação) não divide por zero no que mais pesa", () => {
    const p = evaluateProductCost(xBurger({ cost: d(0), lines: [{ name: "Água", cost: d(0) }] }));
    expect(p.share!.toString()).toBe("0");
    expect(p.heaviest).toBeNull();
  });

  it("empate no que mais pesa fica com a primeira linha", () => {
    const p = evaluateProductCost(
      xBurger({
        cost: d(4),
        lines: [
          { name: "A", cost: d(2) },
          { name: "B", cost: d(2) },
        ],
      }),
    );
    expect(p.heaviest!.name).toBe("A");
  });
});

describe("ordem e resumo do painel (spec 008, US2)", () => {
  const rows = [
    xBurger({ id: "barato", name: "Pastel", salePrice: d(10), cost: d(2) }), // 20%
    xBurger({ id: "sem-preco-b", name: "Batata", salePrice: null }),
    xBurger({ id: "sem-custo", name: "Açaí", cost: null, missingCostNames: ["Polpa"] }),
    xBurger({ id: "caro", name: "Picanha", salePrice: d(50), cost: d(25) }), // 50%
    xBurger({ id: "atencao", name: "Lasanha", salePrice: d(40), cost: d(15) }), // 37,5%
    xBurger({ id: "sem-preco-a", name: "Arroz", salePrice: null }),
    xBurger({ id: "empate-b", name: "Strogonoff", salePrice: d(10), cost: d(2) }), // 20%
  ].map(evaluateProductCost);

  it("maior % primeiro; depois sem preço; depois sem custo; empate pelo nome", () => {
    expect(rankProductCosts(rows).map((r) => r.id)).toEqual([
      "caro",
      "atencao",
      "barato",
      "empate-b",
      "sem-preco-a",
      "sem-preco-b",
      "sem-custo",
    ]);
  });

  it("resumo conta alto, atenção, dentro da faixa, sem preço e sem custo", () => {
    expect(summarizeProductCosts(rows)).toEqual({ total: 7, high: 1, warn: 1, ok: 2, noPrice: 2, noCost: 1 });
  });

  it("sem custo e sem preço conta só como sem custo", () => {
    const r = evaluateProductCost(xBurger({ cost: null, salePrice: null }));
    expect(summarizeProductCosts([r])).toEqual({ total: 1, high: 0, warn: 0, ok: 0, noPrice: 0, noCost: 1 });
  });
});

describe("preço de venda (spec 008, FR-001)", () => {
  it("nomes das faixas na tela e preço com exatamente 2 casas (spec 018)", () => {
    expect(COST_BAND_LABELS).toEqual({ OK: "dentro da faixa", WARN: "atenção", HIGH: "alto" });
    expect(validateSalePrice(d("12.34")).ok).toBe(true);
  });

  it("em branco pode (produto sem preço)", () => {
    expect(validateSalePrice(null).ok).toBe(true);
  });

  it("maior que zero e com até 2 casas", () => {
    expect(validateSalePrice(d("28.00")).ok).toBe(true);
    for (const bad of ["0", "-1", "28.001", "10000000000"]) {
      const r = validateSalePrice(d(bad));
      expect(r.ok ? "OK" : `${r.error.code}:${r.error.field}`, bad).toBe("INVALID_PRICE:salePrice");
    }
  });
});

describe("linha mais cara sem custo nas linhas (spec 018)", () => {
  it("custo total sem nenhuma linha com custo não aponta linha mais cara", () => {
    const p = evaluateProductCost(xBurger({ lines: [{ name: "Pão", cost: null }] }));
    expect(p.heaviest).toBeNull();
  });
});

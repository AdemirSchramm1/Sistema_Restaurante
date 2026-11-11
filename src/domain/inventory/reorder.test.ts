import { describe, it, expect } from "vitest";
import {
  averageDailyUsage,
  calculateReorder,
  cycleDaysFromDeliveryDays,
  isAtReorderPoint,
  orderQuantity,
  planOrder,
  roundUpToPackage,
  suggestReorderLevels,
  validateReorderLevels,
} from "./reorder";
import { d } from "../shared/decimal";

const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "OK" : r.error!.code);
const s = (v: { toString(): string } | null | undefined) => (v == null ? null : v.toString());

describe("reposição (docs/produto/estoque/08-ciclo-operacional.md#planejamento)", () => {
  const filet = {
    averageDailyUsage: d(6),
    leadTimeDays: 1,
    reorderCycleDays: d(3),
    safetyMargin: d("0.2"),
    currentBalance: d("9.6"),
    inTransit: d(0),
  };

  it("calcula ES, PP, par e quantidade a pedir do exemplo do filé mignon", () => {
    const r = calculateReorder(filet);
    expect(s(r.safetyStock)).toBe("3.6");
    expect(s(r.reorderPoint)).toBe("9.6");
    expect(s(r.parLevel)).toBe("21.6");
    expect(s(r.orderQuantity)).toBe("18");
  });

  it("desconta o que já está a caminho", () => {
    expect(s(calculateReorder({ ...filet, inTransit: d(5) }).orderQuantity)).toBe("13");
  });

  it("acima do par não pede nada", () => {
    expect(s(calculateReorder({ ...filet, currentBalance: d(30) }).orderQuantity)).toBe("0");
  });

  it("arredonda para cima na embalagem: 18 kg em caixa de 5 kg = 4 caixas (20 kg)", () => {
    const r = roundUpToPackage(d(18), d(5));
    expect(s(r.packages)).toBe("4");
    expect(s(r.quantity)).toBe("20");
    expect(s(roundUpToPackage(d(20), d(5)).packages)).toBe("4");
  });

  it("saldo negativo (venda sem estoque lançado, spec 011) conta como zero: acabou", () => {
    expect(
      s(orderQuantity({ parLevel: d(30), balance: d("-0.3"), averageDailyUsage: d(0), leadTimeDays: 2 })),
    ).toBe("30");
  });

  it("sem consumo, pedir = comprar até − saldo", () => {
    expect(
      s(orderQuantity({ parLevel: d(30), balance: d(8), averageDailyUsage: d(0), leadTimeDays: 2 })),
    ).toBe("22");
  });
});

describe("item no ponto (spec 006, FR-003)", () => {
  it("avisa quando o saldo é menor ou igual ao ponto", () => {
    expect(isAtReorderPoint({ active: true, balance: d(10), reorderPoint: d(10) })).toBe(true);
    expect(isAtReorderPoint({ active: true, balance: d("9.5"), reorderPoint: d(10) })).toBe(true);
    expect(isAtReorderPoint({ active: true, balance: d("10.01"), reorderPoint: d(10) })).toBe(false);
  });

  it("sem ponto definido ou item inativo não avisa", () => {
    expect(isAtReorderPoint({ active: true, balance: d(0), reorderPoint: null })).toBe(false);
    expect(isAtReorderPoint({ active: false, balance: d(0), reorderPoint: d(5) })).toBe(false);
  });
});

describe("campos do aviso (spec 006, FR-001)", () => {
  it("aceita só o ponto, os dois, ou nenhum", () => {
    expect(code(validateReorderLevels({ reorderPoint: d(10), parLevel: null }))).toBe("OK");
    expect(code(validateReorderLevels({ reorderPoint: d(10), parLevel: d(30) }))).toBe("OK");
    expect(code(validateReorderLevels({ reorderPoint: d(0), parLevel: d(5) }))).toBe("OK");
    expect(code(validateReorderLevels({ reorderPoint: null, parLevel: null }))).toBe("OK");
  });

  it("recusa comprar até sem ponto, menor ou igual ao ponto, negativo ou com mais de 4 casas", () => {
    const bad = (reorderPoint: string | null, parLevel: string | null) =>
      validateReorderLevels({
        reorderPoint: reorderPoint === null ? null : d(reorderPoint),
        parLevel: parLevel === null ? null : d(parLevel),
      });
    expect(code(bad(null, "30"))).toBe("INVALID_REORDER_LEVELS");
    expect(code(bad("10", "10"))).toBe("INVALID_REORDER_LEVELS");
    expect(code(bad("10", "5"))).toBe("INVALID_REORDER_LEVELS");
    expect(code(bad("-1", null))).toBe("INVALID_QUANTITY");
    expect(code(bad("1.00001", null))).toBe("INVALID_QUANTITY");
    expect(code(bad("1", "99999999999"))).toBe("INVALID_QUANTITY");
  });

  it("aponta o campo com problema", () => {
    const r = validateReorderLevels({ reorderPoint: d(10), parLevel: d(5) });
    expect(r.ok ? null : r.error.field).toBe("parLevel");
  });
});

describe("sugestão pelo consumo (spec 006, FR-005)", () => {
  it("ciclo pelos dias de entrega: 2 dias por semana = 3,5 dias; sem dias = 7", () => {
    expect(s(cycleDaysFromDeliveryDays(2))).toBe("3.5");
    expect(s(cycleDaysFromDeliveryDays(7))).toBe("1");
    expect(s(cycleDaysFromDeliveryDays(0))).toBe("7");
  });

  it("consumo médio diário = consumo do período ÷ dias", () => {
    expect(s(averageDailyUsage(d(180), 30))).toBe("6");
  });

  it("180 kg em 30 dias, entrega 1 dia depois, a cada 3,5 dias: PP 10,2 e comprar até 25,2", () => {
    const r = suggestReorderLevels({
      consumed: d(180),
      periodDays: 30,
      leadTimeDays: 1,
      deliveryDaysCount: 2,
    });
    expect(r).not.toBeNull();
    expect(s(r!.averageDailyUsage)).toBe("6");
    // ES = 6 × 3,5 × 0,2 = 4,2; PP = 6 × 1 + 4,2; Par = 6 × 3,5 + 4,2
    expect(s(r!.reorderPoint)).toBe("10.2");
    expect(s(r!.parLevel)).toBe("25.2");
  });

  it("sem fornecedor preferido usa prazo de 1 dia e ciclo de 7 dias", () => {
    const r = suggestReorderLevels({
      consumed: d(30),
      periodDays: 30,
      leadTimeDays: null,
      deliveryDaysCount: 0,
    });
    // CMD 1; ES = 1 × 7 × 0,2 = 1,4; PP = 1 + 1,4; Par = 7 + 1,4
    expect(s(r!.reorderPoint)).toBe("2.4");
    expect(s(r!.parLevel)).toBe("8.4");
  });

  it("sem consumo não há sugestão", () => {
    expect(
      suggestReorderLevels({ consumed: d(0), periodDays: 30, leadTimeDays: 1, deliveryDaysCount: 2 }),
    ).toBeNull();
  });
});

describe("quanto comprar na lista Repor (spec 006, FR-006)", () => {
  it("na embalagem do fornecedor: 18 kg em caixa de 5 kg = 4 Caixas (20 kg)", () => {
    const r = planOrder({
      balance: d("9.6"),
      parLevel: d("21.6"),
      averageDailyUsage: d(6),
      leadTimeDays: 1,
      package: { label: "Caixa", quantity: d(5) },
    });
    expect(s(r.quantity)).toBe("18");
    expect(r.packages).toEqual({ count: d(4), label: "Caixa", total: d(20) });
  });

  it("sem embalagem fica na medida do item", () => {
    const r = planOrder({
      balance: d(2),
      parLevel: d(10),
      averageDailyUsage: d(0),
      leadTimeDays: 1,
      package: null,
    });
    expect(s(r.quantity)).toBe("8");
    expect(r.packages).toBeNull();
  });

  it("sem comprar até não calcula quantidade", () => {
    const r = planOrder({
      balance: d(2),
      parLevel: null,
      averageDailyUsage: d(1),
      leadTimeDays: 1,
      package: null,
    });
    expect(r.quantity).toBeNull();
    expect(r.packages).toBeNull();
  });

  it("nada a comprar não vira embalagem", () => {
    const r = planOrder({
      balance: d(50),
      parLevel: d(30),
      averageDailyUsage: d(0),
      leadTimeDays: 1,
      package: { label: "Caixa", quantity: d(5) },
    });
    expect(s(r.quantity)).toBe("0");
    expect(r.packages).toBeNull();
  });
});

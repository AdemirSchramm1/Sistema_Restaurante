import { describe, it, expect } from "vitest";
import {
  checkAdjustmentDecision,
  planAdjustmentApproval,
  planAdjustmentRequest,
  planLoss,
  planPurchase,
  planReversal,
  type StockItem,
} from "./movement";
import { MOVEMENT_REASONS, reasonByCode } from "./movement-reasons";
import { d } from "../shared/decimal";

const NOW = new Date("2026-11-02T12:00:00Z");
/** Tomate: 10 kg a R$ 3,00, comprado em caixa de 20 kg. */
const tomato = (over: Partial<StockItem> = {}): StockItem => ({
  id: "tomate",
  active: true,
  stockUnit: "kg",
  purchaseUnitLabel: "Caixa",
  purchaseFactor: d(20),
  averageCost: d(3),
  balance: d(10),
  ...over,
});
const loss = reasonByCode("LOSS", "BURNT")!;
const adjust = reasonByCode("ADJUSTMENT", "SHELF_CHECK")!;
const reversal = reasonByCode("REVERSAL", "WRONG_ENTRY")!;

const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "OK" : r.error!.code);
const field = (r: { ok: boolean; error?: { field?: string } }) => (r.ok ? undefined : r.error!.field);

describe("motivos em lista fechada (06-movimentacoes, FR-009)", () => {
  it("perda tem as três famílias; acerto e estorno têm motivos próprios", () => {
    const families = new Set(MOVEMENT_REASONS.filter((r) => r.movementType === "LOSS").map((r) => r.family));
    expect([...families]).toEqual(["PREP", "SPOILAGE", "OPERATIONAL"]);
    expect(MOVEMENT_REASONS.some((r) => r.movementType === "ADJUSTMENT")).toBe(true);
    expect(MOVEMENT_REASONS.some((r) => r.movementType === "REVERSAL")).toBe(true);
    expect(new Set(MOVEMENT_REASONS.map((r) => r.id)).size).toBe(MOVEMENT_REASONS.length);
  });
});

describe("compra (spec 004, US1)", () => {
  it("3 caixas de 20 kg por R$ 240,00: entram 60 kg a R$ 4,00/kg; média vai a R$ 3,857…", () => {
    const r = planPurchase(
      tomato(),
      { quantity: d(3), unit: "PACKAGE", totalPaid: d(240), occurredAt: NOW },
      NOW,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.quantity.toString()).toBe("60");
    expect(r.value.unitCost.toString()).toBe("4");
    expect(r.value.totalCost.toString()).toBe("240");
    expect(r.value.enteredUnit).toBe("Caixa");
    expect(r.value.newAverageCost.toString()).toBe("3.8571");
  });

  it("compra na medida do item ou numa da mesma família (500 g de item em kg)", () => {
    const r = planPurchase(tomato(), { quantity: d(500), unit: "g", totalPaid: d(5), occurredAt: NOW }, NOW);
    expect(r.ok && [r.value.quantity.toString(), r.value.unitCost.toString()]).toEqual(["0.5", "10"]);
  });

  it("custo por medida guardado com 4 casas", () => {
    const r = planPurchase(tomato(), { quantity: d(3), unit: "kg", totalPaid: d(10), occurredAt: NOW }, NOW);
    expect(r.ok && r.value.unitCost.toString()).toBe("3.3333");
  });

  it("recusa embalagem em item que não tem embalagem", () => {
    const item = tomato({ purchaseUnitLabel: null, purchaseFactor: null });
    const r = planPurchase(item, { quantity: d(1), unit: "PACKAGE", totalPaid: d(1), occurredAt: NOW }, NOW);
    expect(code(r)).toBe("UNKNOWN_UNIT");
  });

  it("recusa medida de outra família, quantidade zero, valor negativo e data futura", () => {
    const base = { quantity: d(1), unit: "kg" as const, totalPaid: d(1), occurredAt: NOW };
    expect(code(planPurchase(tomato(), { ...base, unit: "un" }, NOW))).toBe("UNIT_DIMENSION_MISMATCH");
    expect(field(planPurchase(tomato(), { ...base, quantity: d(0) }, NOW))).toBe("quantity");
    expect(code(planPurchase(tomato(), { ...base, totalPaid: d(-1) }, NOW))).toBe("INVALID_AMOUNT");
    const tomorrow = new Date("2026-11-03T12:00:00Z");
    expect(code(planPurchase(tomato(), { ...base, occurredAt: tomorrow }, NOW))).toBe("FUTURE_DATE");
  });

  it("aceita compra de valor zero (brinde)", () => {
    expect(
      code(planPurchase(tomato(), { quantity: d(1), unit: "kg", totalPaid: d(0), occurredAt: NOW }, NOW)),
    ).toBe("OK");
  });

  it("item inativo não recebe lançamento", () => {
    const r = planPurchase(
      tomato({ active: false }),
      { quantity: d(1), unit: "kg", totalPaid: d(1), occurredAt: NOW },
      NOW,
    );
    expect(code(r)).toBe("ITEM_INACTIVE");
  });
});

describe("perda (spec 004, US2)", () => {
  it("500 g queimados de item em kg saem 0,5 kg pelo custo médio", () => {
    const r = planLoss(tomato(), { quantity: d(500), unit: "g", reason: loss, occurredAt: NOW }, NOW);
    expect(
      r.ok && [r.value.quantity.toString(), r.value.unitCost.toString(), r.value.totalCost.toString()],
    ).toEqual(["-0.5", "3", "-1.5"]);
  });

  it("motivo precisa ser de perda", () => {
    const r = planLoss(tomato(), { quantity: d(1), unit: "kg", reason: adjust, occurredAt: NOW }, NOW);
    expect(code(r)).toBe("INVALID_REASON");
    expect(field(r)).toBe("reasonId");
  });

  it("perda maior que o saldo é recusada e diz quanto há", () => {
    const r = planLoss(
      tomato({ balance: d(2) }),
      { quantity: d(3), unit: "kg", reason: loss, occurredAt: NOW },
      NOW,
    );
    expect(code(r)).toBe("INSUFFICIENT_STOCK");
    if (!r.ok) expect(r.error.details).toEqual({ available: "2", unit: "kg" });
  });

  it("perda do saldo inteiro é aceita", () => {
    expect(
      code(planLoss(tomato(), { quantity: d(10), unit: "kg", reason: loss, occurredAt: NOW }, NOW)),
    ).toBe("OK");
  });
});

describe("acerto com aprovação (spec 004, US3)", () => {
  it("sistema 10 kg, prateleira 8 kg: faltam 2 kg", () => {
    const r = planAdjustmentRequest(tomato(), { countedQuantity: d(8), unit: "kg", reason: adjust });
    expect(
      r.ok && [
        r.value.systemQuantity.toString(),
        r.value.countedQuantity.toString(),
        r.value.difference.toString(),
      ],
    ).toEqual(["10", "8", "-2"]);
  });

  it("aceita a quantidade em g e sobra também", () => {
    const r = planAdjustmentRequest(tomato(), { countedQuantity: d(10500), unit: "g", reason: adjust });
    expect(r.ok && r.value.difference.toString()).toBe("0.5");
  });

  it("sem diferença: o saldo já é esse", () => {
    expect(
      code(planAdjustmentRequest(tomato(), { countedQuantity: d(10), unit: "kg", reason: adjust })),
    ).toBe("NO_CHANGE");
  });

  it("quantidade negativa e motivo de outro tipo são recusados", () => {
    expect(
      code(planAdjustmentRequest(tomato(), { countedQuantity: d(-1), unit: "kg", reason: adjust })),
    ).toBe("INVALID_QUANTITY");
    expect(code(planAdjustmentRequest(tomato(), { countedQuantity: d(1), unit: "kg", reason: loss }))).toBe(
      "INVALID_REASON",
    );
  });

  it("quem pediu não aprova o próprio acerto; só pedido pendente é decidido", () => {
    expect(code(checkAdjustmentDecision({ status: "PENDING", requestedBy: "ana" }, "ana"))).toBe(
      "SELF_APPROVAL",
    );
    expect(code(checkAdjustmentDecision({ status: "PENDING", requestedBy: "ana" }, "bia"))).toBe("OK");
    expect(code(checkAdjustmentDecision({ status: "APPROVED", requestedBy: "ana" }, "bia"))).toBe(
      "REQUEST_NOT_PENDING",
    );
  });

  it("aprovar lança a diferença do pedido pelo custo médio, sem deixar saldo negativo", () => {
    const r = planAdjustmentApproval(tomato(), d(-2));
    expect(r.ok && [r.value.quantity.toString(), r.value.totalCost.toString()]).toEqual(["-2", "-6"]);
    expect(code(planAdjustmentApproval(tomato({ balance: d(1) }), d(-2)))).toBe("INSUFFICIENT_STOCK");
  });
});

describe("estorno (spec 004, US5)", () => {
  const purchase = {
    type: "PURCHASE" as const,
    quantity: d(60),
    unitCost: d(4),
    totalCost: d(240),
    reversed: false,
  };

  it("estorno de compra tira o que entrou e recalcula a média", () => {
    const item = tomato({ balance: d(70), averageCost: d("3.857142857142857142857") });
    const r = planReversal(purchase, item, reversal);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.quantity.toString()).toBe("-60");
    expect(r.value.totalCost.toString()).toBe("-240");
    expect(r.value.newAverageCost?.toDecimalPlaces(4).toString()).toBe("3");
  });

  it("estorno de perda devolve a quantidade e não mexe na média", () => {
    const r = planReversal(
      { type: "LOSS", quantity: d("-0.5"), unitCost: d(3), totalCost: d("-1.5"), reversed: false },
      tomato(),
      reversal,
    );
    expect(r.ok && [r.value.quantity.toString(), r.value.newAverageCost]).toEqual(["0.5", null]);
  });

  it("não estorna duas vezes, não estorna estorno e recusa se deixaria saldo negativo", () => {
    expect(code(planReversal({ ...purchase, reversed: true }, tomato(), reversal))).toBe("ALREADY_REVERSED");
    expect(code(planReversal({ ...purchase, type: "REVERSAL" }, tomato(), reversal))).toBe(
      "CANNOT_REVERSE_REVERSAL",
    );
    expect(code(planReversal(purchase, tomato({ balance: d(20) }), reversal))).toBe("INSUFFICIENT_STOCK");
    expect(code(planReversal(purchase, tomato({ balance: d(70) }), loss))).toBe("INVALID_REASON");
  });

  it("estorno de lançamento de item inativado depois continua possível", () => {
    expect(code(planReversal(purchase, tomato({ active: false, balance: d(70) }), reversal))).toBe("OK");
  });
});

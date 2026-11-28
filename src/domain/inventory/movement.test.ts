import { describe, it, expect } from "vitest";
import {
  checkAdjustmentDecision,
  planAdjustmentApproval,
  MOVEMENT_TYPE_LABELS,
  planAdjustmentRequest,
  planCancelledSale,
  planLoss,
  planPurchase,
  planReversal,
  planSale,
  type StockItem,
} from "./movement";
import { manualReasons, MOVEMENT_REASONS, reasonByCode } from "./movement-reasons";
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

describe("compra na embalagem do fornecedor (spec 007, US4)", () => {
  it("2 caixas de 18 kg do fornecedor por R$ 180,00: entram 36 kg a R$ 5,00/kg", () => {
    const r = planPurchase(
      tomato(),
      {
        quantity: d(2),
        unit: { packageLabel: "Caixa", packageQuantity: d(18) },
        totalPaid: d(180),
        occurredAt: NOW,
      },
      NOW,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.quantity.toString()).toBe("36");
    expect(r.value.unitCost.toString()).toBe("5");
    expect(r.value.enteredQuantity.toString()).toBe("2");
    expect(r.value.enteredUnit).toBe("Caixa");
  });

  it("vale também para item sem embalagem própria", () => {
    const r = planPurchase(
      tomato({ purchaseUnitLabel: null, purchaseFactor: null }),
      {
        quantity: d(1),
        unit: { packageLabel: "Saco", packageQuantity: d(25) },
        totalPaid: d(50),
        occurredAt: NOW,
      },
      NOW,
    );
    expect(r.ok && r.value.quantity.toString()).toBe("25");
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
    expect(r.value.newAverageCost.toString()).toBe("3.85714286");
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
    const item = tomato({ balance: d(70), averageCost: d("3.85714286") });
    const r = planReversal(purchase, item, reversal);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.quantity.toString()).toBe("-60");
    expect(r.value.totalCost.toString()).toBe("-240");
    expect(r.value.newAverageCost?.toDecimalPlaces(4).toString()).toBe("3");
    expect(r.value.newAverageCost?.decimalPlaces()).toBeLessThanOrEqual(8);
    expect(r.value.newAverageCost?.decimalPlaces()).toBeLessThanOrEqual(8);
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

describe("venda pelo pedido (spec 011, US4 e FR-006)", () => {
  /** Queijo: 1 kg a R$ 50,00/kg. */
  const cheese = (over: Partial<StockItem> = {}) =>
    tomato({ id: "queijo", averageCost: d(50), balance: d(1), purchaseFactor: null, ...over });
  const view = (r: ReturnType<typeof planSale>) =>
    r.ok
      ? [
          r.value.quantity.toString(),
          r.value.unitCost.toString(),
          r.value.totalCost.toString(),
          r.value.enteredQuantity.toString(),
          r.value.enteredUnit,
        ]
      : r.error.code;

  it("tipo novo em português", () => {
    expect(MOVEMENT_TYPE_LABELS.SALE_RECIPE).toBe("Venda");
  });

  it("sai o consumo do pedido pelo custo médio do momento: 0,14 kg de queijo a R$ 50,00", () => {
    expect(view(planSale(cheese(), d("0.14")))).toEqual(["-0.14", "50", "-7", "0.14", "kg"]);
  });

  it("não bloqueia por saldo: a venda pode deixar o saldo negativo", () => {
    expect(view(planSale(cheese({ balance: d("0.1") }), d("0.2")))).toEqual([
      "-0.2",
      "50",
      "-10",
      "0.2",
      "kg",
    ]);
  });

  it("item sem custo ainda sai com custo zero", () => {
    expect(view(planSale(cheese({ averageCost: null }), d("0.14")))).toEqual([
      "-0.14",
      "0",
      "0",
      "0.14",
      "kg",
    ]);
  });

  it("item inativo também baixa", () => {
    expect(view(planSale(cheese({ active: false }), d("0.14")))[0]).toBe("-0.14");
  });

  it("quantidade com até 4 casas, a precisão do livro; o que arredonda para zero não sai", () => {
    expect(view(planSale(cheese(), d("0.033333333")))[0]).toBe("-0.0333");
    expect(view(planSale(cheese(), d("0.00005")))[0]).toBe("-0.0001");
    expect(view(planSale(cheese(), d("0.00004")))).toBe("INVALID_QUANTITY");
    expect(view(planSale(cheese(), d("0")))).toBe("INVALID_QUANTITY");
    expect(view(planSale(cheese(), d("-1")))).toBe("INVALID_QUANTITY");
  });
});

describe("pedido cancelado depois do preparo (spec 011, US5 e FR-008)", () => {
  const sale = {
    type: "SALE_RECIPE" as const,
    quantity: d("-0.14"),
    unitCost: d(50),
    totalCost: d("-7"),
    reversed: false,
  };
  const reasons = {
    reversal: reasonByCode("REVERSAL", "ORDER_CANCELLED"),
    loss: reasonByCode("LOSS", "ORDER_CANCELLED"),
  };
  const line = (p: {
    quantity: { toString(): string };
    unitCost: { toString(): string };
    totalCost: { toString(): string };
  }) => [p.quantity.toString(), p.unitCost.toString(), p.totalCost.toString()];

  it("motivos 'Pedido cancelado' no estorno e na perda (família erro na operação)", () => {
    expect(reasons.reversal?.label).toBe("Pedido cancelado");
    expect(reasons.loss?.label).toBe("Pedido cancelado");
    expect(reasons.loss?.family).toBe("OPERATIONAL");
  });

  it("ingredientes usados: estorna a venda e lança a perda com o mesmo custo", () => {
    const r = planCancelledSale(sale, tomato({ balance: d("0.86") }), true, reasons);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(line(r.value.reversal)).toEqual(["0.14", "50", "7"]);
    expect(r.value.loss && line(r.value.loss)).toEqual(["-0.14", "50", "-7"]);
  });

  it("ingredientes não usados: só o estorno, o estoque volta", () => {
    const r = planCancelledSale(sale, tomato(), false, reasons);
    expect(r.ok && [line(r.value.reversal), r.value.loss]).toEqual([["0.14", "50", "7"], null]);
  });

  it("a perda do cancelamento não é bloqueada por saldo", () => {
    expect(code(planCancelledSale(sale, tomato({ balance: d("-3") }), true, reasons))).toBe("OK");
  });

  it("só venda, uma vez só, com os motivos certos", () => {
    expect(code(planCancelledSale({ ...sale, type: "LOSS" }, tomato(), true, reasons))).toBe("VALIDATION");
    expect(code(planCancelledSale({ ...sale, reversed: true }, tomato(), true, reasons))).toBe(
      "ALREADY_REVERSED",
    );
    expect(code(planCancelledSale(sale, tomato(), true, { ...reasons, loss: reversal }))).toBe(
      "INVALID_REASON",
    );
    expect(code(planCancelledSale(sale, tomato(), false, { ...reasons, reversal: loss }))).toBe(
      "INVALID_REASON",
    );
  });

  it("'Pedido cancelado' só vem do cancelamento: fora das listas e recusado na perda e no estorno à mão", () => {
    expect(manualReasons("LOSS").map((r) => r.code)).not.toContain("ORDER_CANCELLED");
    expect(manualReasons("REVERSAL").map((r) => r.code)).not.toContain("ORDER_CANCELLED");
    expect(manualReasons("LOSS")).toHaveLength(11);
    expect(manualReasons("REVERSAL")).toHaveLength(3);
    const manualLoss = planLoss(
      tomato(),
      { quantity: d(1), unit: "kg", reason: reasons.loss, occurredAt: NOW },
      NOW,
    );
    expect(code(manualLoss)).toBe("INVALID_REASON");
    const burnt = {
      type: "LOSS" as const,
      quantity: d(-1),
      unitCost: d(3),
      totalCost: d(-3),
      reversed: false,
    };
    expect(code(planReversal(burnt, tomato(), reasons.reversal))).toBe("INVALID_REASON");
  });

  it("venda não se estorna à mão: desfaz cancelando o pedido", () => {
    expect(code(planReversal(sale, tomato(), reversal))).toBe("REVERSE_VIA_ORDER");
  });

  it("perda comum continua bloqueada por saldo", () => {
    const r = planLoss(
      tomato({ balance: d("0.1") }),
      { quantity: d("0.2"), unit: "kg", reason: loss, occurredAt: NOW },
      NOW,
    );
    expect(code(r)).toBe("INSUFFICIENT_STOCK");
  });
});

describe("limites e recusas de cada lançamento (spec 018, US2 e R4)", () => {
  const fail = (r: { ok: boolean; error?: { code: string; field?: string } }) =>
    r.ok ? "OK" : `${r.error!.code} ${r.error!.field ?? "-"}`;
  const buy = { quantity: d(1), unit: "kg" as const, totalPaid: d(1), occurredAt: NOW };
  const lose = { quantity: d(1), unit: "kg" as const, reason: loss, occurredAt: NOW };
  const tomorrow = new Date("2026-11-03T12:00:00Z");

  it("nomes dos tipos na tela", () => {
    expect(MOVEMENT_TYPE_LABELS).toEqual({
      PURCHASE: "Entrada (compra)",
      LOSS: "Perda",
      ADJUSTMENT: "Acerto",
      REVERSAL: "Estorno",
      SALE_RECIPE: "Venda",
    });
  });

  it("quantidade aceita até 4 casas, a precisão do livro; 5 casas é recusada", () => {
    expect(fail(planPurchase(tomato(), { ...buy, quantity: d("0.0001") }, NOW))).toBe("OK");
    expect(fail(planPurchase(tomato(), { ...buy, quantity: d("0.00001") }, NOW))).toBe(
      "INVALID_QUANTITY quantity",
    );
    expect(fail(planLoss(tomato(), { ...lose, quantity: d("1.0001") }, NOW))).toBe("OK");
    expect(fail(planLoss(tomato(), { ...lose, quantity: d("1.00001") }, NOW))).toBe(
      "INVALID_QUANTITY quantity",
    );
  });

  it("compra: valor com até 2 casas; cada recusa aponta o campo", () => {
    expect(fail(planPurchase(tomato(), { ...buy, totalPaid: d("10.25") }, NOW))).toBe("OK");
    expect(fail(planPurchase(tomato(), { ...buy, totalPaid: d("10.255") }, NOW))).toBe(
      "INVALID_AMOUNT totalPaid",
    );
    expect(fail(planPurchase(tomato({ active: false }), buy, NOW))).toBe("ITEM_INACTIVE itemId");
    expect(fail(planPurchase(tomato(), { ...buy, occurredAt: tomorrow }, NOW))).toBe(
      "FUTURE_DATE occurredAt",
    );
    expect(fail(planPurchase(tomato(), { ...buy, unit: "un" }, NOW))).toBe("UNIT_DIMENSION_MISMATCH unit");
    expect(fail(planPurchase(tomato({ purchaseFactor: null }), { ...buy, unit: "PACKAGE" }, NOW))).toBe(
      "UNKNOWN_UNIT unit",
    );
    expect(fail(planPurchase(tomato(), { ...buy, unit: "cx" as "kg" }, NOW))).toBe("UNKNOWN_UNIT unit");
    expect(fail(planPurchase(tomato({ purchaseFactor: d(0) }), { ...buy, unit: "PACKAGE" }, NOW))).toBe(
      "INVALID_FACTOR unit",
    );
    const supplierBox = { packageLabel: "Caixa do fornecedor", packageQuantity: d(0) };
    expect(fail(planPurchase(tomato(), { ...buy, unit: supplierBox }, NOW))).toBe("INVALID_FACTOR unit");
  });

  it("compra na medida digitada guarda a medida digitada, não o nome da embalagem", () => {
    const r = planPurchase(tomato(), { ...buy, quantity: d(500), unit: "g" }, NOW);
    expect(r.ok && r.value.enteredUnit).toBe("g");
  });

  it("perda: item inativo, quantidade, data e medida recusados com o campo", () => {
    expect(fail(planLoss(tomato({ active: false }), lose, NOW))).toBe("ITEM_INACTIVE itemId");
    expect(fail(planLoss(tomato(), { ...lose, quantity: d(0) }, NOW))).toBe("INVALID_QUANTITY quantity");
    expect(fail(planLoss(tomato(), { ...lose, occurredAt: tomorrow }, NOW))).toBe("FUTURE_DATE occurredAt");
    expect(fail(planLoss(tomato(), { ...lose, unit: "un" }, NOW))).toBe("UNIT_DIMENSION_MISMATCH unit");
    expect(fail(planLoss(tomato(), { ...lose, quantity: d(11) }, NOW))).toBe("INSUFFICIENT_STOCK quantity");
  });

  it("pedido de acerto: item inativo, até 4 casas, medida certa", () => {
    const ask = { countedQuantity: d(8), unit: "kg" as const, reason: adjust };
    expect(fail(planAdjustmentRequest(tomato({ active: false }), ask))).toBe("ITEM_INACTIVE itemId");
    expect(fail(planAdjustmentRequest(tomato(), { ...ask, countedQuantity: d("8.0001") }))).toBe("OK");
    expect(fail(planAdjustmentRequest(tomato(), { ...ask, countedQuantity: d("8.00001") }))).toBe(
      "INVALID_QUANTITY countedQuantity",
    );
    expect(fail(planAdjustmentRequest(tomato(), { ...ask, unit: "un" }))).toBe(
      "UNIT_DIMENSION_MISMATCH unit",
    );
    expect(fail(planAdjustmentRequest(tomato(), { ...ask, countedQuantity: d(10) }))).toBe(
      "NO_CHANGE countedQuantity",
    );
  });

  it("acerto para mais é aprovado mesmo com o saldo negativo pelas vendas", () => {
    const r = planAdjustmentApproval(tomato({ balance: d(-5) }), d(3));
    expect(r.ok && [r.value.quantity.toString(), r.value.totalCost.toString()]).toEqual(["3", "9"]);
  });

  it("estorno que deixaria saldo negativo diz o campo quantidade", () => {
    const purchase = {
      type: "PURCHASE" as const,
      quantity: d(20),
      unitCost: d(3),
      totalCost: d(60),
      reversed: false,
    };
    expect(fail(planReversal(purchase, tomato(), reversal))).toBe("INSUFFICIENT_STOCK quantity");
  });

  it("venda: quantidade que arredonda para zero aponta o campo", () => {
    expect(fail(planSale(tomato(), d("0.00001")))).toBe("INVALID_QUANTITY quantity");
  });

  it("cancelamento sem usar os ingredientes não precisa do motivo de perda", () => {
    const sale = {
      type: "SALE_RECIPE" as const,
      quantity: d("-1"),
      unitCost: d(3),
      totalCost: d(-3),
      reversed: false,
    };
    const r = planCancelledSale(sale, tomato(), false, {
      reversal: reasonByCode("REVERSAL", "ORDER_CANCELLED"),
      loss: undefined,
    });
    expect(fail(r)).toBe("OK");
    expect(
      fail(planCancelledSale({ ...sale, type: "LOSS" }, tomato(), false, { reversal, loss: undefined })),
    ).toBe("VALIDATION movementId");
  });
});

describe("item com saldo e sem custo médio (spec 018, US2)", () => {
  it("perda e acerto para menos saem com custo zero", () => {
    const noAvg = tomato({ averageCost: null });
    const out = planLoss(noAvg, { quantity: d(1), unit: "kg", reason: loss, occurredAt: NOW }, NOW);
    expect(out.ok && [out.value.unitCost.toString(), out.value.totalCost.toString()]).toEqual(["0", "0"]);
    const adj = planAdjustmentApproval(noAvg, d(-2));
    expect(adj.ok && [adj.value.unitCost.toString(), adj.value.totalCost.toString()]).toEqual(["0", "0"]);
  });
});

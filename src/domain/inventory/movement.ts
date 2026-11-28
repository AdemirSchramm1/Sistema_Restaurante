import { d, Decimal } from "../shared/decimal";
import { err, ok, type Result } from "../shared/result";
import { applyPurchase, removePurchase } from "./average-cost";
import type { MovementReason, ReasonMovementType } from "./movement-reasons";
import { convert, toStockUnit, unitByCode, type UnitCode } from "./units";

/** Tipos de movimentação desta versão (spec 004, FR-001; venda na spec 011). */
export const MOVEMENT_TYPES = ["PURCHASE", "LOSS", "ADJUSTMENT", "REVERSAL", "SALE_RECIPE"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  PURCHASE: "Entrada (compra)",
  LOSS: "Perda",
  ADJUSTMENT: "Acerto",
  REVERSAL: "Estorno",
  SALE_RECIPE: "Venda",
};

/** O que o domínio precisa saber do item para lançar. */
export type StockItem = {
  id: string;
  active: boolean;
  stockUnit: UnitCode;
  purchaseUnitLabel: string | null;
  purchaseFactor: Decimal | null;
  averageCost: Decimal | null;
  balance: Decimal;
};

/** Linha pronta para o livro. Quantidade e total com sinal (+ entra, − sai). */
export type PlannedMovement = {
  quantity: Decimal;
  unitCost: Decimal;
  totalCost: Decimal;
  enteredQuantity: Decimal;
  enteredUnit: string;
};

const QTY_SCALE = 4;
/** Pontos de arredondamento definidos na spec (FR-008): custo unitário com 4, médio com 8, total com 2. */
const cost4 = (v: Decimal) => v.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
const avg8 = (v: Decimal) => v.toDecimalPlaces(8, Decimal.ROUND_HALF_UP);
const money2 = (v: Decimal) => v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

const positive = (q: Decimal) => q.gt(0) && q.decimalPlaces() <= QTY_SCALE;

function checkDate(at: Date, now: Date): Result<void> {
  return at.getTime() > now.getTime() ? err("FUTURE_DATE", "occurredAt") : ok(undefined);
}

/** Motivo do tipo certo; os do sistema ("Pedido cancelado") só valem quando o sistema lança. */
function checkReason(
  reason: MovementReason | undefined,
  type: ReasonMovementType,
  bySystem = false,
): Result<MovementReason> {
  return reason && reason.movementType === type && (bySystem || !reason.system)
    ? ok(reason)
    : err("INVALID_REASON", "reasonId");
}

/** Embalagem de um fornecedor (spec 007): nome e quanto vem, na medida do item. */
export type SupplierPackage = { packageLabel: string; packageQuantity: Decimal };
type PurchaseUnit = UnitCode | "PACKAGE" | SupplierPackage;

/** Quantidade digitada (na medida do item, numa da mesma família ou em embalagens) → medida do item. */
function toItemUnit(item: StockItem, qty: Decimal, unit: PurchaseUnit): Result<Decimal> {
  if (typeof unit === "object") {
    const r = toStockUnit(qty, unit.packageQuantity);
    return r.ok ? r : err(r.error.code, "unit");
  }
  if (unit === "PACKAGE") {
    if (!item.purchaseFactor) return err("UNKNOWN_UNIT", "unit");
    const r = toStockUnit(qty, item.purchaseFactor);
    return r.ok ? r : err(r.error.code, "unit");
  }
  const from = unitByCode(unit);
  if (!from) return err("UNKNOWN_UNIT", "unit");
  const r = convert(qty, from, unitByCode(item.stockUnit)!);
  return r.ok ? r : err("UNIT_DIMENSION_MISMATCH", "unit", r.error.details);
}

const insufficient = (item: StockItem) =>
  err("INSUFFICIENT_STOCK", "quantity", { available: item.balance.toString(), unit: item.stockUnit });

/** Saída pelo custo médio do momento; nunca deixa saldo negativo (FR-005). */
function outflow(item: StockItem, qty: Decimal): Result<{ unitCost: Decimal; totalCost: Decimal }> {
  if (item.balance.plus(qty).lt(0)) return insufficient(item);
  const unitCost = cost4(item.averageCost ?? d(0));
  return ok({ unitCost, totalCost: money2(qty.times(unitCost)) });
}

export type PurchaseInput = {
  quantity: Decimal;
  unit: PurchaseUnit;
  totalPaid: Decimal;
  occurredAt: Date;
};

/** Compra: entra na medida do item; custo por medida = total pago ÷ quantidade (US1). */
export function planPurchase(
  item: StockItem,
  input: PurchaseInput,
  now: Date,
): Result<PlannedMovement & { newAverageCost: Decimal; newLastCost: Decimal }> {
  if (!item.active) return err("ITEM_INACTIVE", "itemId");
  if (!positive(input.quantity)) return err("INVALID_QUANTITY", "quantity");
  if (input.totalPaid.lt(0) || input.totalPaid.decimalPlaces() > 2) return err("INVALID_AMOUNT", "totalPaid");
  const date = checkDate(input.occurredAt, now);
  if (!date.ok) return date;
  const qty = toItemUnit(item, input.quantity, input.unit);
  if (!qty.ok) return qty;
  const unitCost = cost4(input.totalPaid.dividedBy(qty.value));
  return ok({
    quantity: qty.value,
    unitCost,
    totalCost: input.totalPaid,
    enteredQuantity: input.quantity,
    enteredUnit:
      typeof input.unit === "object"
        ? input.unit.packageLabel
        : input.unit === "PACKAGE"
          ? item.purchaseUnitLabel!
          : input.unit,
    newAverageCost: avg8(
      applyPurchase({ qty: item.balance, avgCost: item.averageCost }, { qty: qty.value, unitCost }),
    ),
    newLastCost: unitCost,
  });
}

export type LossInput = {
  quantity: Decimal;
  unit: UnitCode;
  reason: MovementReason | undefined;
  occurredAt: Date;
};

/** Perda com motivo de lista fechada; sai pelo custo médio (US2). */
export function planLoss(item: StockItem, input: LossInput, now: Date): Result<PlannedMovement> {
  if (!item.active) return err("ITEM_INACTIVE", "itemId");
  if (!positive(input.quantity)) return err("INVALID_QUANTITY", "quantity");
  const reason = checkReason(input.reason, "LOSS");
  if (!reason.ok) return reason;
  const date = checkDate(input.occurredAt, now);
  if (!date.ok) return date;
  const qty = toItemUnit(item, input.quantity, input.unit);
  if (!qty.ok) return qty;
  const out = outflow(item, qty.value.negated());
  if (!out.ok) return out;
  return ok({
    quantity: qty.value.negated(),
    ...out.value,
    enteredQuantity: input.quantity,
    enteredUnit: input.unit,
  });
}

export type AdjustmentRequestInput = {
  countedQuantity: Decimal;
  unit: UnitCode;
  reason: MovementReason | undefined;
};

/** Pedido de acerto: quanto tem de verdade → diferença para o saldo do sistema (US3). */
export function planAdjustmentRequest(
  item: StockItem,
  input: AdjustmentRequestInput,
): Result<{ systemQuantity: Decimal; countedQuantity: Decimal; difference: Decimal }> {
  if (!item.active) return err("ITEM_INACTIVE", "itemId");
  if (input.countedQuantity.lt(0) || input.countedQuantity.decimalPlaces() > QTY_SCALE)
    return err("INVALID_QUANTITY", "countedQuantity");
  const reason = checkReason(input.reason, "ADJUSTMENT");
  if (!reason.ok) return reason;
  const counted = toItemUnit(item, input.countedQuantity, input.unit);
  if (!counted.ok) return err(counted.error.code, "unit");
  const difference = counted.value.minus(item.balance);
  if (difference.isZero()) return err("NO_CHANGE", "countedQuantity");
  return ok({ systemQuantity: item.balance, countedQuantity: counted.value, difference });
}

export type AdjustmentStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

/**
 * Só pedido pendente é decidido, e nunca por quem pediu (constituição V), exceto no modo operação
 * pequena (spec 019, US2): aí quem pediu decide e a decisão fica marcada (`selfDecided`).
 */
export function checkAdjustmentDecision(
  request: { status: AdjustmentStatus; requestedBy: string },
  deciderId: string,
  smallOperation: boolean,
): Result<{ selfDecided: boolean }> {
  if (request.status !== "PENDING") return err("REQUEST_NOT_PENDING");
  const selfDecided = request.requestedBy === deciderId;
  if (selfDecided && !smallOperation) return err("SELF_APPROVAL");
  return ok({ selfDecided });
}

/** Aprovação: lança a diferença do pedido pelo custo médio. */
export function planAdjustmentApproval(item: StockItem, difference: Decimal): Result<PlannedMovement> {
  const unitCost = cost4(item.averageCost ?? d(0));
  if (difference.lt(0)) {
    const out = outflow(item, difference);
    if (!out.ok) return out;
  }
  return ok({
    quantity: difference,
    unitCost,
    totalCost: money2(difference.times(unitCost)),
    enteredQuantity: difference,
    enteredUnit: item.stockUnit,
  });
}

export type OriginalMovement = {
  type: MovementType;
  quantity: Decimal;
  unitCost: Decimal;
  totalCost: Decimal;
  reversed: boolean;
};

/** Estorno: movimentação inversa, uma vez só; estorno de compra recalcula a média (US5). */
export function planReversal(
  original: OriginalMovement,
  item: StockItem,
  reason: MovementReason | undefined,
): Result<PlannedMovement & { newAverageCost: Decimal | null }> {
  if (original.type === "REVERSAL") return err("CANNOT_REVERSE_REVERSAL");
  if (original.type === "SALE_RECIPE") return err("REVERSE_VIA_ORDER");
  if (original.reversed) return err("ALREADY_REVERSED");
  const r = checkReason(reason, "REVERSAL");
  if (!r.ok) return r;
  const quantity = original.quantity.negated();
  if (item.balance.plus(quantity).lt(0)) return insufficient(item);
  const newAverageCost =
    original.type === "PURCHASE" && item.averageCost
      ? avg8(
          removePurchase(
            { qty: item.balance, avgCost: item.averageCost },
            { qty: original.quantity, unitCost: original.unitCost },
          ),
        )
      : null;
  return ok({
    quantity,
    unitCost: original.unitCost,
    totalCost: original.totalCost.negated(),
    enteredQuantity: quantity,
    enteredUnit: item.stockUnit,
    newAverageCost,
  });
}

/** Inverte o sinal sem gerar "−0". */
const negate = (v: Decimal) => (v.isZero() ? d(0) : v.negated());

/**
 * Venda pelo pedido (spec 011, FR-006 e FR-007): sai o consumo, na medida do item e com a precisão
 * do livro (4 casas), pelo custo médio do momento. Nunca bloqueia por saldo nem por item inativo:
 * o pedido não pode parar. Não muda o custo médio.
 */
export function planSale(item: StockItem, quantity: Decimal): Result<PlannedMovement> {
  const qty = quantity.toDecimalPlaces(QTY_SCALE, Decimal.ROUND_HALF_UP);
  if (!qty.gt(0)) return err("INVALID_QUANTITY", "quantity");
  const unitCost = cost4(item.averageCost ?? d(0));
  return ok({
    quantity: qty.negated(),
    unitCost,
    totalCost: negate(money2(qty.times(unitCost))),
    enteredQuantity: qty,
    enteredUnit: item.stockUnit,
  });
}

/**
 * Pedido cancelado depois do preparo (spec 011, FR-008): estorna a venda e, se os ingredientes foram
 * usados, lança a mesma saída como perda "Pedido cancelado". Mesmo custo da venda e sem bloqueio por
 * saldo: o saldo final é o mesmo de antes (usados) ou volta (não usados).
 */
export function planCancelledSale(
  sale: OriginalMovement,
  item: StockItem,
  ingredientsUsed: boolean,
  reasons: { reversal: MovementReason | undefined; loss: MovementReason | undefined },
): Result<{ reversal: PlannedMovement; loss: PlannedMovement | null }> {
  if (sale.type !== "SALE_RECIPE") return err("VALIDATION", "movementId");
  if (sale.reversed) return err("ALREADY_REVERSED");
  const reversalReason = checkReason(reasons.reversal, "REVERSAL", true);
  if (!reversalReason.ok) return reversalReason;
  if (ingredientsUsed) {
    const lossReason = checkReason(reasons.loss, "LOSS", true);
    if (!lossReason.ok) return lossReason;
  }
  const back = negate(sale.quantity);
  const reversal: PlannedMovement = {
    quantity: back,
    unitCost: sale.unitCost,
    totalCost: negate(sale.totalCost),
    enteredQuantity: back,
    enteredUnit: item.stockUnit,
  };
  const loss: PlannedMovement | null = ingredientsUsed
    ? {
        quantity: sale.quantity,
        unitCost: sale.unitCost,
        totalCost: sale.totalCost,
        enteredQuantity: back,
        enteredUnit: item.stockUnit,
      }
    : null;
  return ok({ reversal, loss });
}

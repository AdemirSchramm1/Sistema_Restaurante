import { UNITS, type UnitCode } from "@/domain/inventory/units";
import { parseBrDecimal, type Decimal } from "@/domain/shared/decimal";
import { err, ok, type ErrorCode, type Result } from "@/domain/shared/result";
import type { AdjustmentRequestCommand, LossCommand, PurchaseCommand, ReversalCommand } from "./movements";
import { formText } from "../form-input";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Fuso dos restaurantes nesta versão (Brasília, sem horário de verão desde 2019). */
const OFFSET = "-03:00";
const UNIT_CODES = UNITS.map((u) => u.code) as string[];

const optText = (v: unknown) => formText(v) || null;

/** Dia de hoje (AAAA-MM-DD) em Brasília: o valor padrão do campo de data do lançamento. */
export const movementToday = (now: Date): string =>
  new Date(now.getTime() - 3 * 3600_000).toISOString().slice(0, 10);

/** "2026-10-30" → meio-dia daquele dia em Brasília; hoje (ou vazio) → agora. Inválida → null. */
export function parseMovementDate(value: string, now: Date): Date | null {
  const t = value.trim();
  if (!t || t === movementToday(now)) return now;
  if (!DATE.test(t)) return null;
  const at = new Date(`${t}T12:00:00${OFFSET}`);
  return Number.isNaN(at.getTime()) ? null : at;
}

function decimal(v: unknown, field: string, code: ErrorCode = "INVALID_NUMBER"): Result<Decimal> {
  const t = formText(v);
  if (!t) return err(code === "INVALID_NUMBER" ? "INVALID_QUANTITY" : code, field);
  const r = parseBrDecimal(t);
  return r.ok ? r : err(code, field);
}

type FormUnit = UnitCode | "PACKAGE" | "SUPPLIER_PACKAGE";

/** Embalagens (do item ou do fornecedor) só na compra. */
function unit(v: unknown, allowPackage: boolean): Result<FormUnit> {
  const t = formText(v);
  if (UNIT_CODES.includes(t) || (allowPackage && (t === "PACKAGE" || t === "SUPPLIER_PACKAGE")))
    return ok(t as FormUnit);
  return err("UNKNOWN_UNIT", "unit");
}

export type ParsedMovement =
  | { type: "PURCHASE"; cmd: PurchaseCommand }
  | { type: "LOSS"; cmd: LossCommand }
  | { type: "ADJUSTMENT"; cmd: AdjustmentRequestCommand };

/** Formulário de lançamento → comando do caso de uso, conforme o tipo. */
export function parseMovementForm(raw: Record<string, unknown>, now: Date): Result<ParsedMovement> {
  const type = formText(raw.type);
  if (!["PURCHASE", "LOSS", "ADJUSTMENT"].includes(type)) return err("VALIDATION", "type");
  const itemId = formText(raw.itemId);
  if (!UUID.test(itemId)) return err("VALIDATION", "itemId");
  const notes = optText(raw.notes);
  const idempotencyKey = optText(raw.idempotencyKey);
  const reasonId = formText(raw.reasonId);
  if (type !== "PURCHASE" && !UUID.test(reasonId)) return err("INVALID_REASON", "reasonId");

  if (type === "ADJUSTMENT") {
    const counted = decimal(raw.countedQuantity, "countedQuantity");
    if (!counted.ok) return counted;
    const u = unit(raw.unit, false);
    if (!u.ok) return u;
    return ok({
      type,
      cmd: { itemId, countedQuantity: counted.value, unit: u.value as UnitCode, reasonId, notes },
    });
  }

  const quantity = decimal(raw.quantity, "quantity");
  if (!quantity.ok) return quantity;
  const u = unit(raw.unit, type === "PURCHASE");
  if (!u.ok) return u;
  const occurredAt = parseMovementDate(formText(raw.occurredAt), now);
  if (!occurredAt) return err("VALIDATION", "occurredAt");

  if (type === "PURCHASE") {
    const supplierId = optText(raw.supplierId);
    if (supplierId && !UUID.test(supplierId)) return err("VALIDATION", "supplierId");
    const totalPaid = decimal(raw.totalPaid, "totalPaid", "INVALID_AMOUNT");
    if (!totalPaid.ok) return totalPaid;
    return ok({
      type,
      cmd: {
        itemId,
        supplierId,
        quantity: quantity.value,
        unit: u.value,
        totalPaid: totalPaid.value,
        occurredAt,
        notes,
        idempotencyKey,
      },
    });
  }
  return ok({
    type: "LOSS",
    cmd: {
      itemId,
      quantity: quantity.value,
      unit: u.value as UnitCode,
      reasonId,
      occurredAt,
      notes,
      idempotencyKey,
    },
  });
}

/** Formulário de estorno. */
export function parseReversalForm(
  raw: Record<string, unknown>,
): Result<{ movementId: string; cmd: ReversalCommand }> {
  const movementId = formText(raw.movementId);
  if (!UUID.test(movementId)) return err("NOT_FOUND");
  const reasonId = formText(raw.reasonId);
  if (!UUID.test(reasonId)) return err("INVALID_REASON", "reasonId");
  return ok({
    movementId,
    cmd: { reasonId, notes: optText(raw.notes), idempotencyKey: optText(raw.idempotencyKey) },
  });
}

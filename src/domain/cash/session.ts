import type { Decimal } from "../shared/decimal";
import { err, ok, type Result } from "../shared/result";

/** Abrir e fechar o turno do caixa (spec 014, FR-001 e FR-005). */

export const CASH_NOTE_MAX = 140;

/** Zero ou mais, com até 2 casas. */
export const isCashAmount = (v: Decimal) => !v.isNegative() && v.decimalPlaces() <= 2;

/** Observação sem espaços nas pontas; vazia vira nula. */
export function cleanNote(note: string | null | undefined): Result<string | null> {
  const text = (note ?? "").trim();
  if (text.length > CASH_NOTE_MAX) return err("NOTE_TOO_LONG", "note");
  return ok(text || null);
}

/**
 * Abrir pede o troco (R$ 0,00 ou mais). Se o turno anterior deixou outro valor na gaveta, a
 * observação é obrigatória; no primeiro turno não há o que comparar.
 */
export function checkOpening(input: {
  openingFloat: Decimal;
  previousKept: Decimal | null;
  note: string | null;
}): Result<{ openingFloat: Decimal; note: string | null }> {
  if (!isCashAmount(input.openingFloat)) return err("INVALID_AMOUNT", "openingFloat");
  const note = cleanNote(input.note);
  if (!note.ok) return note;
  if (input.previousKept !== null && !input.previousKept.equals(input.openingFloat) && !note.value)
    return err("OPENING_NOTE_REQUIRED", "note", { previousKept: input.previousKept.toFixed(2) });
  return ok({ openingFloat: input.openingFloat, note: note.value });
}

export type ClosingOutcome = "BALANCED" | "OVER" | "SHORT";

/** Diferença zero bate; positiva sobra; negativa falta. */
export const outcomeOf = (difference: Decimal): ClosingOutcome =>
  difference.isZero() ? "BALANCED" : difference.isPositive() ? "OVER" : "SHORT";

/**
 * Diferença = contado − esperado; com diferença a observação é obrigatória. O que fica na gaveta
 * vai de zero ao contado (sem informar, fica tudo); o resto é a retirada do fechamento.
 */
export function closingResult(input: {
  expected: Decimal;
  counted: Decimal;
  kept: Decimal | null;
  note: string | null;
}): Result<{
  difference: Decimal;
  result: ClosingOutcome;
  kept: Decimal;
  takenToSafe: Decimal;
  note: string | null;
}> {
  const note = cleanNote(input.note);
  if (!note.ok) return note;
  const kept = input.kept ?? input.counted;
  if (!isCashAmount(kept)) return err("INVALID_AMOUNT", "kept");
  if (kept.gt(input.counted)) return err("KEPT_ABOVE_COUNTED", "kept");
  const difference = input.counted.minus(input.expected);
  if (!difference.isZero() && !note.value) return err("NOTE_REQUIRED", "note", { reason: "difference" });
  return ok({
    difference,
    result: outcomeOf(difference),
    kept,
    takenToSafe: input.counted.minus(kept),
    note: note.value,
  });
}

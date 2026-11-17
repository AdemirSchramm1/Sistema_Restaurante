import type { Decimal } from "../shared/decimal";
import { err, ok, type Result } from "../shared/result";
import { cleanNote } from "./session";

/** Sangria (dinheiro que sai da gaveta) e reforço (dinheiro que entra): spec 014, FR-003. */

export const ENTRY_KINDS = ["WITHDRAWAL", "SUPPLY"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];
export const ENTRY_KIND_LABELS: Record<EntryKind, string> = { WITHDRAWAL: "Sangria", SUPPLY: "Reforço" };
export const isEntryKind = (v: unknown): v is EntryKind => (ENTRY_KINDS as readonly unknown[]).includes(v);

/** Motivos da sangria, lista fechada. */
export const WITHDRAWAL_REASONS = ["SAFE", "SUPPLIER_PAYMENT", "DAILY_EXPENSE", "OTHER"] as const;
export type WithdrawalReason = (typeof WITHDRAWAL_REASONS)[number];
export const WITHDRAWAL_REASON_LABELS: Record<WithdrawalReason, string> = {
  SAFE: "Cofre",
  SUPPLIER_PAYMENT: "Pagamento a fornecedor",
  DAILY_EXPENSE: "Despesa do dia",
  OTHER: "Outro",
};
export const isWithdrawalReason = (v: unknown): v is WithdrawalReason =>
  (WITHDRAWAL_REASONS as readonly unknown[]).includes(v);

const isEntryAmount = (v: Decimal) => v.gt(0) && v.decimalPlaces() <= 2;

/**
 * Sangria: valor maior que zero, motivo da lista (em Outro a observação é obrigatória) e nunca
 * acima do dinheiro que a gaveta deve ter.
 */
export function checkWithdrawal(
  input: { amount: Decimal; reason: unknown; note: string | null },
  expected: Decimal,
): Result<{ amount: Decimal; reason: WithdrawalReason; note: string | null }> {
  if (!isEntryAmount(input.amount)) return err("INVALID_AMOUNT", "amount");
  if (!isWithdrawalReason(input.reason)) return err("REASON_REQUIRED", "reason");
  const note = cleanNote(input.note);
  if (!note.ok) return note;
  if (input.reason === "OTHER" && !note.value) return err("NOTE_REQUIRED", "note", { reason: "other" });
  if (input.amount.gt(expected))
    return err("WITHDRAWAL_EXCEEDS_EXPECTED", "amount", { expected: expected.toFixed(2) });
  return ok({ amount: input.amount, reason: input.reason, note: note.value });
}

/** Reforço: valor maior que zero e observação opcional. */
export function checkSupply(input: {
  amount: Decimal;
  note: string | null;
}): Result<{ amount: Decimal; note: string | null }> {
  if (!isEntryAmount(input.amount)) return err("INVALID_AMOUNT", "amount");
  const note = cleanNote(input.note);
  if (!note.ok) return note;
  return ok({ amount: input.amount, note: note.value });
}

/** Tirar um reforço não pode deixar o esperado negativo: antes, tira-se uma sangria. */
export function checkSupplyRemoval(amount: Decimal, expected: Decimal): Result<void> {
  return expected.minus(amount).isNegative() ? err("EXPECTED_WOULD_BE_NEGATIVE") : ok(undefined);
}

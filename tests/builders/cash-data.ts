import { d } from "../../src/domain/shared/decimal";

/** Dados de teste do caixa do dia (spec 014): os números da spec e do quickstart. */
export const OPENING_FLOAT = "150.00";

export const openingInput = (openingFloat = OPENING_FLOAT, note: string | null = null) => ({
  openingFloat: d(openingFloat),
  note,
  clientRequestId: crypto.randomUUID(),
});

export const withdrawalInput = (amount = "150.00", reason: unknown = "SAFE", note: string | null = null) => ({
  kind: "WITHDRAWAL" as const,
  amount: d(amount),
  reason,
  note,
  clientRequestId: crypto.randomUUID(),
});

export const supplyInput = (amount = "50.00", note: string | null = null) => ({
  kind: "SUPPLY" as const,
  amount: d(amount),
  reason: null,
  note,
  clientRequestId: crypto.randomUUID(),
});

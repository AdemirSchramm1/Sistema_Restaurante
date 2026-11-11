import { err, ok, type Result } from "../shared/result";

/** Situações do pedido (spec 009, FR-008). */
export const ORDER_STATUSES = ["RECEIVED", "PREPARING", "READY", "DELIVERED", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  RECEIVED: "Recebido",
  PREPARING: "Em preparo",
  READY: "Pronto",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

export const CANCEL_REASONS = ["CUSTOMER_GAVE_UP", "OUT_OF_PRODUCT", "IMPROPER_ORDER", "OTHER"] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];

export const CANCEL_REASON_LABELS: Record<CancelReason, string> = {
  CUSTOMER_GAVE_UP: "Cliente desistiu",
  OUT_OF_PRODUCT: "Produto acabou",
  IMPROPER_ORDER: "Pedido indevido",
  OTHER: "Outro",
};

export const CANCEL_NOTE_MAX = 140;
export const LATE_MINUTES = 20;

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  RECEIVED: "PREPARING",
  PREPARING: "READY",
  READY: "DELIVERED",
};

export const isFinal = (s: OrderStatus): boolean => s === "DELIVERED" || s === "CANCELLED";

/** Só para frente, um passo por vez. */
export function checkTransition(from: OrderStatus, to: OrderStatus): Result<void> {
  return NEXT[from] === to ? ok(undefined) : err("INVALID_ORDER_TRANSITION", undefined, { from, to });
}

/** Cancela qualquer pedido não final, com motivo da lista; "Outro" exige texto. */
export function checkCancel(
  from: OrderStatus,
  reason: CancelReason,
  note: string | null,
): Result<{ reason: CancelReason; note: string | null }> {
  if (!CANCEL_REASONS.includes(reason)) return err("VALIDATION", "reason");
  if (isFinal(from)) return err("INVALID_ORDER_TRANSITION", undefined, { from, to: "CANCELLED" });
  const text = note?.trim() || null;
  if (text && text.length > CANCEL_NOTE_MAX) return err("NOTE_TOO_LONG", "note");
  if (reason === "OTHER" && !text) return err("CANCEL_NOTE_REQUIRED", "note");
  return ok({ reason, note: text });
}

/** Esqueleto (vermelho). */
export const leftTheShelf = (_s: OrderStatus): boolean => false;

/** Mais de 20 minutos sem ficar pronto (spec 009, US4-7). */
export function isLate(status: OrderStatus, submittedAt: Date, now: Date): boolean {
  if (status !== "RECEIVED" && status !== "PREPARING") return false;
  return now.getTime() - submittedAt.getTime() > LATE_MINUTES * 60_000;
}

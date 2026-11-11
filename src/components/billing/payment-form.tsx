"use client";

import type { ActionState } from "@/actions/_session";
import type { CloseBlocker } from "@/domain/billing/tab";
import type { PaymentMethod } from "@/domain/billing/payment";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/** Esqueleto (vermelho). */
export function PaymentForm(_props: {
  tabId: string;
  remaining: string;
  action: Action;
  fill?: { amount: string; at: number } | null;
}) {
  return null;
}

export function CloseTabForm(_props: {
  tab: { id: string; version: number; remaining: string; blockers: CloseBlocker[] };
  action: Action;
}) {
  return null;
}

export type PaymentRow = {
  id: string;
  method: PaymentMethod;
  amount: string;
  received: string | null;
  change: string | null;
  at: string;
  byName: string | null;
  removedAt: string | null;
  removedByName: string | null;
};

export function PaymentList(_props: { tabId: string; payments: PaymentRow[]; timezone: string; remove?: Action }) {
  return null;
}

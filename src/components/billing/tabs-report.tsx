"use client";

import type { ActionState } from "@/actions/_session";
import type { PaymentMethod } from "@/domain/billing/payment";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

export type ClosedTabView = {
  id: string;
  tableName: string;
  openedAt: string;
  closedAt: string;
  closedByName: string | null;
  subtotal: string;
  serviceCharge: string;
  total: string;
};

/** Esqueleto (vermelho). */
export function TabsReport(_props: {
  tabs: ClosedTabView[];
  summary: { byMethod: { method: PaymentMethod; amount: string }[]; serviceCharge: string; total: string };
  timezone: string;
}) {
  return null;
}

export function ReopenTabForm(_props: { tab: { id: string; version: number }; action: Action }) {
  return null;
}

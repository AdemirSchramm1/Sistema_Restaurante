"use client";

import type { ActionState } from "@/actions/_session";

export type SalePriceProps = {
  id: string;
  version: number;
  /** Já formatado com vírgula; null = sem preço. */
  salePrice: string | null;
  costText: string | null;
  shareText: string | null;
  bandLabel: string | null;
  marginText: string | null;
  marginNegative: boolean;
  canEdit: boolean;
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
};

/** Esqueleto (spec 008, US1). */
export function SalePrice(_p: SalePriceProps) {
  return null;
}

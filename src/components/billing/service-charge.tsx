"use client";

import type { ActionState } from "@/actions/_session";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/** Esqueleto (vermelho). */
export function ServiceChargeToggle(_props: {
  tab: { id: string; version: number; serviceRate: string | null; serviceWaived: boolean; serviceCharge: string };
  action: Action;
}) {
  return null;
}

export function ServiceRateForm(_props: { rate: string | null; version: number; action: Action }) {
  return null;
}

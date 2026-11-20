import { refKey, type ComponentRef } from "../inventory/recipe";

/** O que define um envio da equipe: a mesa e as linhas (spec 015, R2). */
export type StaffRequest = {
  tableId: string;
  lines: {
    recipeId: string;
    quantity: number;
    addons: { addonId: string; times: number }[];
    removals: ComponentRef[];
    kitchenNote: string | null;
  }[];
};

const lineKey = (l: StaffRequest["lines"][number]): string =>
  JSON.stringify([
    l.recipeId,
    l.quantity,
    l.addons.map((a) => `${a.addonId}×${a.times}`).sort(),
    l.removals.map(refKey).sort(),
    l.kitchenNote ?? null,
  ]);

const key = (r: StaffRequest): string => JSON.stringify([r.tableId, r.lines.map(lineKey).sort()]);

/**
 * O mesmo envio chegou de novo? Mesma mesa e as mesmas linhas, em qualquer ordem (FR-011). Outro
 * conteúdo com o mesmo id é recusado, nunca devolvido como se fosse o pedido antigo.
 */
export const sameRequest = (stored: StaffRequest, requested: StaffRequest): boolean =>
  key(stored) === key(requested);

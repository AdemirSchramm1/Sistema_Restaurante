import type { ComponentRef } from "../inventory/recipe";

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
export const sameRequest = (_a: StaffRequest, _b: StaffRequest): boolean => false;

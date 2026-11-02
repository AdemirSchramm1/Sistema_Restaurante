import { err, ok, type Result } from "../shared/result";

export const ROLES = ["MANAGER", "CHEF", "STOCKKEEPER", "BUYER", "ADMINISTRATIVE"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  MANAGER: "Gerente",
  CHEF: "Chef",
  STOCKKEEPER: "Estoquista",
  BUYER: "Comprador",
  ADMINISTRATIVE: "Administrativo",
};

export const ACTIONS = [
  "catalog.read",
  "item.write",
  "item.cogs_override",
  "recipe.write",
  "movement.purchase",
  "movement.loss",
  "adjustment.request",
  "adjustment.approve",
  "movement.reverse",
  "supplier.write",
  "group.manage",
  "user.invite",
  "user.manage",
] as const;
export type Action = (typeof ACTIONS)[number];

const MATRIX: Record<Role, readonly Action[]> = {
  MANAGER: ACTIONS,
  CHEF: ["catalog.read", "item.write", "recipe.write", "movement.loss", "adjustment.request"],
  STOCKKEEPER: ["catalog.read", "movement.purchase", "movement.loss", "adjustment.request"],
  BUYER: ["catalog.read", "movement.purchase", "adjustment.request", "supplier.write"],
  ADMINISTRATIVE: ["catalog.read"],
};

export function can(roles: readonly Role[], action: Action): boolean {
  return roles.some((r) => MATRIX[r].includes(action));
}

export function assertCan(roles: readonly Role[], action: Action): Result<true> {
  return can(roles, action) ? ok(true) : err("FORBIDDEN", undefined, { action });
}

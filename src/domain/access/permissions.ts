import { err, ok, type Result } from "../shared/result";

export const ROLES = [
  "MANAGER",
  "CHEF",
  "STOCKKEEPER",
  "BUYER",
  "ADMINISTRATIVE",
  "WAITER",
  "CASHIER",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  MANAGER: "Gerente",
  CHEF: "Chef",
  STOCKKEEPER: "Estoquista",
  BUYER: "Comprador",
  ADMINISTRATIVE: "Administrativo",
  WAITER: "Garçom",
  CASHIER: "Caixa",
};

export const ACTIONS = [
  "catalog.read",
  "item.write",
  "item.cogs_override",
  "item.reorder",
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
  "table.manage",
  "ordering.toggle",
  "order.kitchen",
  "order.cancel",
  "order.deliver",
  "order.read",
  "product.sold_out",
  "addon.read",
  "addon.write",
  "tab.read",
  "tab.pay",
  "tab.history",
  "tab.reopen",
  "tab.settings",
  "menu.write",
] as const;
export type Action = (typeof ACTIONS)[number];

const MATRIX: Record<Role, readonly Action[]> = {
  MANAGER: ACTIONS,
  CHEF: [
    "catalog.read",
    "item.write",
    "item.reorder",
    "recipe.write",
    "movement.loss",
    "adjustment.request",
    "order.kitchen",
    "order.cancel",
    "order.deliver",
    "order.read",
    "product.sold_out",
    "addon.read",
  ],
  STOCKKEEPER: ["catalog.read", "movement.purchase", "movement.loss", "adjustment.request"],
  BUYER: ["catalog.read", "item.reorder", "movement.purchase", "adjustment.request", "supplier.write"],
  ADMINISTRATIVE: ["catalog.read"],
  WAITER: ["order.deliver", "order.read", "tab.read"],
  CASHIER: ["order.read", "tab.read", "tab.pay", "tab.history"],
};

export function can(roles: readonly Role[], action: Action): boolean {
  return roles.some((r) => MATRIX[r].includes(action));
}

export function assertCan(roles: readonly Role[], action: Action): Result<true> {
  return can(roles, action) ? ok(true) : err("FORBIDDEN", undefined, { action });
}

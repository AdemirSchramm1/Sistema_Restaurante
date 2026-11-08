import type { Decimal } from "../shared/decimal";
import type { RecipeKind } from "../inventory/recipe";
import { normalizeDescription } from "../inventory/description";

/** O que o cardápio precisa saber de cada produto (spec 009, FR-004). */
export type MenuProductRow = {
  id: string;
  name: string;
  kind: RecipeKind;
  active: boolean;
  salePrice: Decimal | null;
  /** Data local em que foi marcado "Esgotado hoje" (AAAA-MM-DD). */
  soldOutOn: string | null;
};

/** Vendido, ativo, com preço e não esgotado hoje. */
export const isOnMenu = (p: MenuProductRow, today: string): boolean =>
  p.kind === "DISH" && p.active && p.salePrice !== null && p.soldOutOn !== today;

export const isSoldOut = (soldOutOn: string | null, today: string): boolean => soldOutOn === today;

export function buildMenu<T extends MenuProductRow>(rows: readonly T[], today: string): T[] {
  return rows
    .filter((p) => isOnMenu(p, today))
    .sort((a, b) => normalizeDescription(a.name).localeCompare(normalizeDescription(b.name), "pt-BR"));
}

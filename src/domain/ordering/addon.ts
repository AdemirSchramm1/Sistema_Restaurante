import type { Decimal } from "../shared/decimal";
import { d } from "../shared/decimal";
import { err, ok, type Result } from "../shared/result";
import { normalizeDescription } from "../inventory/description";
import { unitByCode, type UnitCode } from "../inventory/units";
import type { ComponentInfo, ComponentRef } from "../inventory/recipe";

/** Adicional: item ou preparo com quantidade e preço (spec 010, US1, FR-001). */
export type AddonData = {
  name: string;
  component: ComponentRef;
  quantity: Decimal;
  unit: UnitCode;
  price: Decimal;
};

export const ADDON_NAME_MAX = 40;
const QTY_SCALE = 4;
const PRICE_MAX = d("9999999999.99");

/** Zero é "Grátis"; negativo e mais de 2 casas não (research R3). */
export function validateAddonPrice(price: Decimal): Result<void> {
  if (price.lt(0) || price.decimalPlaces() > 2 || price.gt(PRICE_MAX)) return err("INVALID_PRICE", "price");
  return ok(undefined);
}

/** Mesmas regras da linha de produto da 003 (research R2). */
export function validateAddon(
  data: AddonData,
  lookup: (ref: ComponentRef) => ComponentInfo | undefined,
): Result<{ name: string; normalized: string }> {
  const name = data.name.trim();
  if (name.length < 1 || name.length > ADDON_NAME_MAX) return err("INVALID_NAME", "name");
  const info = lookup(data.component);
  if (!info) return err("NOT_FOUND", "component");
  if (data.component.kind === "RECIPE" && !info.isSubRecipe) return err("NOT_A_SUB_RECIPE", "component");
  if (!info.active) return err("COMPONENT_INACTIVE", "component");
  if (data.quantity.lte(0) || data.quantity.decimalPlaces() > QTY_SCALE)
    return err("INVALID_QUANTITY", "quantity");
  const unit = unitByCode(data.unit);
  if (!unit) return err("UNKNOWN_UNIT", "unit");
  if (unit.dimension !== unitByCode(info.unit)!.dimension)
    return err("UNIT_DIMENSION_MISMATCH", "unit", { from: data.unit, to: info.unit });
  const price = validateAddonPrice(data.price);
  if (!price.ok) return price;
  return ok({ name, normalized: normalizeDescription(name) });
}

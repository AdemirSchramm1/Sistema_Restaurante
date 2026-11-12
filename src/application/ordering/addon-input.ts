import type { AddonData } from "@/domain/ordering/addon";
import { unitByCode, type UnitCode } from "@/domain/inventory/units";
import { d, parseBrDecimal } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";
import { componentRef, formText } from "../form-input";

/** Formulário do adicional (spec 010): componente como "ITEM:id" ou "RECIPE:id", números com vírgula. */
export function parseAddonForm(raw: Record<string, unknown>): Result<AddonData> {
  const component = componentRef(raw.component);
  if (!component) return err("VALIDATION", "component");
  const quantity = parseBrDecimal(formText(raw.quantity));
  if (!quantity.ok) return err("INVALID_NUMBER", "quantity");
  const unit = formText(raw.unit);
  if (!unitByCode(unit)) return err("UNKNOWN_UNIT", "unit");
  const priceText = formText(raw.price);
  const price = priceText ? parseBrDecimal(priceText) : ok(d(0));
  if (!price.ok) return err("INVALID_NUMBER", "price");
  return ok({
    name: typeof raw.name === "string" ? raw.name : "",
    component,
    quantity: quantity.value,
    unit: unit as UnitCode,
    price: price.value,
  });
}

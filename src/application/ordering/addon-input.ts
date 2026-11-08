import type { AddonData } from "@/domain/ordering/addon";
import { unitByCode, type UnitCode } from "@/domain/inventory/units";
import { d, parseBrDecimal } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Formulário do adicional (spec 010): componente como "ITEM:id" ou "RECIPE:id", números com vírgula. */
export function parseAddonForm(raw: Record<string, unknown>): Result<AddonData> {
  const [kind, id] = text(raw.component).split(":");
  if ((kind !== "ITEM" && kind !== "RECIPE") || !id || !UUID.test(id)) return err("VALIDATION", "component");
  const quantity = parseBrDecimal(text(raw.quantity));
  if (!quantity.ok) return err("INVALID_NUMBER", "quantity");
  const unit = text(raw.unit);
  if (!unitByCode(unit)) return err("UNKNOWN_UNIT", "unit");
  const priceText = text(raw.price);
  const price = priceText ? parseBrDecimal(priceText) : ok(d(0));
  if (!price.ok) return err("INVALID_NUMBER", "price");
  return ok({
    name: typeof raw.name === "string" ? raw.name : "",
    component: { kind, id },
    quantity: quantity.value,
    unit: unit as UnitCode,
    price: price.value,
  });
}

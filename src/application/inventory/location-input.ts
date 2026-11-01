import { LOCATION_KINDS, type LocationData, type LocationKind } from "@/domain/inventory/location";
import { parseBrDecimal, type Decimal } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";

type Raw = Record<string, unknown>;
const text = (raw: Raw, k: string) => (typeof raw[k] === "string" ? (raw[k] as string).trim() : "");

function optionalDecimal(raw: Raw, field: string): Result<Decimal | null> {
  const v = text(raw, field);
  if (!v) return ok(null);
  const r = parseBrDecimal(v);
  return r.ok ? r : err("INVALID_NUMBER", field);
}

/** Converte o formulário de local em `LocationData`. As regras ficam em `validateLocation`. */
export function parseLocationForm(raw: Raw): Result<LocationData> {
  const kind = text(raw, "kind") as LocationKind;
  if (!LOCATION_KINDS.includes(kind)) return err("VALIDATION", "kind");
  const tempMinC = optionalDecimal(raw, "tempMinC");
  if (!tempMinC.ok) return tempMinC;
  const tempMaxC = optionalDecimal(raw, "tempMaxC");
  if (!tempMaxC.ok) return tempMaxC;
  const order = text(raw, "countOrder");
  if (order && !/^\d+$/.test(order)) return err("VALIDATION", "countOrder");
  return ok({
    name: text(raw, "name"),
    kind,
    tempMinC: tempMinC.value,
    tempMaxC: tempMaxC.value,
    responsibleUserId: text(raw, "responsibleUserId") || null,
    countOrder: order ? Number.parseInt(order, 10) : 0,
  });
}

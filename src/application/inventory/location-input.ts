import { LOCATION_KINDS, type LocationData, type LocationKind } from "@/domain/inventory/location";
import { err, ok, type Result } from "@/domain/shared/result";

type Raw = Record<string, unknown>;
const text = (raw: Raw, k: string) => (typeof raw[k] === "string" ? (raw[k] as string).trim() : "");

/** Converte o formulário de local em `LocationData`. As regras ficam em `validateLocation`. */
export function parseLocationForm(raw: Raw): Result<LocationData> {
  const kind = text(raw, "kind") as LocationKind;
  if (!LOCATION_KINDS.includes(kind)) return err("VALIDATION", "kind");
  return ok({ name: text(raw, "name"), kind });
}

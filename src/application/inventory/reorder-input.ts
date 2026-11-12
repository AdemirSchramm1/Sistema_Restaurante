import { parseBrDecimal, type Decimal } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";
import type { ReorderLevels } from "@/domain/inventory/reorder";
import { formText } from "../form-input";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function optional(v: unknown, field: string): Result<Decimal | null> {
  const t = formText(v);
  if (!t) return ok(null);
  const r = parseBrDecimal(t);
  return r.ok ? r : err("INVALID_NUMBER", field);
}

/** Formulário do aviso de reposição (spec 006, US1). Em branco = sem aviso. */
export function parseReorderForm(
  raw: Record<string, unknown>,
): Result<{ id: string; version: number; levels: ReorderLevels }> {
  const id = formText(raw.id);
  const v = formText(raw.version);
  const version = /^\d+$/.test(v) ? Number.parseInt(v, 10) : 0;
  if (!UUID.test(id) || !Number.isInteger(version) || version < 1) return err("VALIDATION");
  const reorderPoint = optional(raw.reorderPoint, "reorderPoint");
  if (!reorderPoint.ok) return reorderPoint;
  const parLevel = optional(raw.parLevel, "parLevel");
  if (!parLevel.ok) return parLevel;
  return ok({ id, version, levels: { reorderPoint: reorderPoint.value, parLevel: parLevel.value } });
}

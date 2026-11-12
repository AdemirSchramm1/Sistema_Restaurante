import {
  RECIPE_KINDS,
  type RecipeData,
  type RecipeKind,
  type RecipeLineData,
} from "@/domain/inventory/recipe";
import { unitByCode, type UnitCode } from "@/domain/inventory/units";
import { parseBrDecimal, type Decimal } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";
import { formText } from "../form-input";

const LINE_KEY = /^lines\.(\d{1,3})\.(component|quantity|unit)$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED = new Set(["name", "kind", "yieldQuantity", "yieldUnit"]);

function decimalOrNull(v: unknown, field: string): Result<Decimal | null> {
  const t = formText(v);
  if (!t) return ok(null);
  const r = parseBrDecimal(t);
  return r.ok ? r : err("INVALID_NUMBER", field);
}

/**
 * Converte o formulário de produto em RecipeData. As linhas chegam como
 * `lines.N.component` ("ITEM:id" ou "RECIPE:id"), `lines.N.quantity` e `lines.N.unit`.
 */
export function parseRecipeForm(raw: Record<string, unknown>): Result<RecipeData> {
  const rows = new Map<number, Record<string, unknown>>();
  for (const [k, v] of Object.entries(raw)) {
    const m = LINE_KEY.exec(k);
    if (m) {
      const i = Number.parseInt(m[1]!, 10);
      rows.set(i, { ...rows.get(i), [m[2]!]: v });
    } else if (!ALLOWED.has(k)) return err("VALIDATION", undefined, { keys: [k] });
  }

  const kind = formText(raw.kind) as RecipeKind;
  if (!RECIPE_KINDS.includes(kind)) return err("VALIDATION", "kind");

  let yieldQuantity: Decimal | null = null;
  let yieldUnit: UnitCode | null = null;
  if (kind === "SUB_RECIPE") {
    const q = decimalOrNull(raw.yieldQuantity, "yieldQuantity");
    if (!q.ok) return q;
    yieldQuantity = q.value;
    const u = formText(raw.yieldUnit);
    if (u && !unitByCode(u)) return err("UNKNOWN_UNIT", "yieldUnit");
    yieldUnit = (u || null) as UnitCode | null;
  }

  const lines: RecipeLineData[] = [];
  const indexes = [...rows.keys()].sort((a, b) => a - b);
  for (const [pos, i] of indexes.entries()) {
    if (pos !== i) return err("VALIDATION", `lines.${pos}.component`);
    const row = rows.get(i)!;
    const [kindPart, id] = formText(row.component).split(":");
    if ((kindPart !== "ITEM" && kindPart !== "RECIPE") || !id || !UUID.test(id))
      return err("VALIDATION", `lines.${i}.component`);
    const q = decimalOrNull(row.quantity, `lines.${i}.quantity`);
    if (!q.ok) return q;
    if (!q.value) return err("INVALID_QUANTITY", `lines.${i}.quantity`);
    const unit = formText(row.unit);
    if (!unitByCode(unit)) return err("UNKNOWN_UNIT", `lines.${i}.unit`);
    lines.push({ component: { kind: kindPart, id }, quantity: q.value, unit: unit as UnitCode });
  }

  return ok({ name: formText(raw.name), kind, yieldQuantity, yieldUnit, lines });
}

/** Formulário do preço de venda (spec 008, US1). Em branco = sem preço. */
export function parseSalePriceForm(
  raw: Record<string, unknown>,
): Result<{ id: string; version: number; salePrice: Decimal | null }> {
  const id = formText(raw.id);
  const v = formText(raw.version);
  const version = /^\d+$/.test(v) ? Number.parseInt(v, 10) : 0;
  if (!UUID.test(id) || version < 1) return err("VALIDATION");
  const price = formText(raw.salePrice);
  if (!price) return ok({ id, version, salePrice: null });
  const parsed = parseBrDecimal(price);
  if (!parsed.ok) return err("INVALID_PRICE", "salePrice");
  return ok({ id, version, salePrice: parsed.value });
}

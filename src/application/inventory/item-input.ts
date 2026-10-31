import { z } from "zod";
import { ITEM_TYPES, COUNT_FREQUENCIES, type ItemData } from "@/domain/inventory/item";
import { UNITS, unitByCode, type UnitCode } from "@/domain/inventory/units";
import { d, parseBrDecimal, type Decimal } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";

const unitCodes = UNITS.map((u) => u.code) as [UnitCode, ...UnitCode[]];
const optText = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null));
const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");
const optInt = z
  .string()
  .optional()
  .transform((v, c) => {
    if (!v || !v.trim()) return null;
    if (!/^\d+$/.test(v.trim())) {
      c.addIssue({ code: "custom", message: "INVALID_DAYS" });
      return z.NEVER;
    }
    return Number.parseInt(v.trim(), 10);
  });
const decimalField = (required: boolean) =>
  z
    .string()
    .optional()
    .transform((v, c): Decimal | null => {
      if (!v || !v.trim()) {
        if (required) c.addIssue({ code: "custom", message: "INVALID_NUMBER" });
        return null;
      }
      const r = parseBrDecimal(v);
      if (!r.ok) {
        c.addIssue({ code: "custom", message: "INVALID_NUMBER" });
        return z.NEVER;
      }
      return r.value;
    });

/** Campos aceitos do formulário de item. Qualquer outro campo (código, custos, curva ABC…) é rejeitado. */
const itemFormSchema = z.strictObject({
  description: z.string(),
  subgroupId: z.uuid(),
  type: z.enum(ITEM_TYPES),
  stockUnit: z.enum(unitCodes),
  recipeUnit: z.enum(unitCodes),
  purchaseUnitLabel: z.string(),
  purchaseFactor: decimalField(true),
  conversionFactor: decimalField(false),
  eanUnit: optText,
  eanPackage: optText,
  noGtin: checkbox,
  financialCategory: optText,
  presentation: optText,
  netWeight: decimalField(false),
  drainedWeight: decimalField(false),
  catchWeight: checkbox,
  correctionFactor: decimalField(false),
  yieldFactor: decimalField(false),
  storageTempMaxC: decimalField(false),
  receivingTempMinC: decimalField(false),
  receivingTempMaxC: decimalField(false),
  shelfLifeDays: optInt,
  openedLifeDays: optInt,
  lotControl: checkbox,
  expiryAlertDays: optInt,
  allergens: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])),
  ncm: optText,
  cest: optText,
  origin: optText,
  taxGroup: optText,
  countable: checkbox,
  countFrequency: z
    .union([z.enum(COUNT_FREQUENCIES), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
});

/** Converte o formulário (texto, vírgula decimal) em ItemData. */
export function parseItemForm(raw: Record<string, unknown>): Result<ItemData> {
  const parsed = itemFormSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    const field = String(issue.path[0] ?? "");
    const known = ["INVALID_NUMBER", "INVALID_DAYS"] as const;
    const code = known.find((k) => k === issue.message) ?? "VALIDATION";
    return err(
      code,
      field || undefined,
      issue.code === "unrecognized_keys" ? { keys: issue.keys } : undefined,
    );
  }
  const v = parsed.data;
  const stock = unitByCode(v.stockUnit)!;
  const recipe = unitByCode(v.recipeUnit)!;
  const conversions =
    stock.dimension !== recipe.dimension && v.conversionFactor
      ? [{ fromUnit: v.stockUnit, toUnit: v.recipeUnit, factor: v.conversionFactor }]
      : [];
  const { conversionFactor: _ignored, ...rest } = v;
  void _ignored;
  return ok({
    ...rest,
    purchaseFactor: v.purchaseFactor!,
    correctionFactor: v.correctionFactor ?? d(1),
    conversions,
    allergens: v.allergens as ItemData["allergens"],
  });
}

/** FormData → objeto, juntando chaves repetidas (alérgenos) e ignorando campos internos do Next. */
export function formDataToObject(form: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    if (k.startsWith("$ACTION") || typeof v !== "string") continue;
    if (k === "allergens") out[k] = [...((out[k] as string[]) ?? []), v];
    else out[k] = v;
  }
  return out;
}

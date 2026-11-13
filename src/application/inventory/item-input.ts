import { z } from "zod";
import { ITEM_TYPES, type ItemData } from "@/domain/inventory/item";
import { UNITS, type UnitCode } from "@/domain/inventory/units";
import { parseBrDecimal, type Decimal } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";

const unitCodes = UNITS.map((u) => u.code) as [UnitCode, ...UnitCode[]];
const optText = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null));
const optDecimal = z
  .string()
  .optional()
  .transform((v, c): Decimal | null => {
    if (!v || !v.trim()) return null;
    const r = parseBrDecimal(v);
    if (!r.ok) {
      c.addIssue({ code: "custom", message: "INVALID_NUMBER" });
      return z.NEVER;
    }
    return r.value;
  });

/** Campos aceitos do formulário de item. Qualquer outro campo (código, custos, campos retirados…) é rejeitado. */
const itemFormSchema = z.strictObject({
  description: z.string(),
  subgroupId: z.uuid(),
  type: z.enum(ITEM_TYPES),
  stockUnit: z.enum(unitCodes),
  purchaseUnitLabel: optText,
  purchaseFactor: optDecimal,
});

/** Converte o formulário (texto, vírgula decimal) em ItemData. */
export function parseItemForm(raw: Record<string, unknown>): Result<ItemData> {
  const parsed = itemFormSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    const field = String(issue.path[0] ?? "");
    const code = issue.message === "INVALID_NUMBER" ? "INVALID_NUMBER" : "VALIDATION";
    return err(
      code,
      field || undefined,
      issue.code === "unrecognized_keys" ? { keys: issue.keys } : undefined,
    );
  }
  return ok(parsed.data);
}

import { z } from "zod";
import type { RequestedLine } from "@/domain/ordering/checkout";
import { d } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";

/**
 * Entrada do envio do pedido (spec 009 public-routes.md, spec 010). Só formato: limites e regras
 * ficam no domínio (`checkOrder`). Qualquer campo a mais, como uma observação livre, é recusado.
 */
const money = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/);
const ref = z.strictObject({ kind: z.enum(["ITEM", "RECIPE"]), id: z.uuid() });
const line = z.strictObject({
  recipeId: z.uuid(),
  quantity: z.number(),
  unitPrice: money,
  addons: z.array(z.strictObject({ addonId: z.uuid(), times: z.number(), unitPrice: money })).max(20),
  removals: z.array(ref).max(20),
});
const schema = z.strictObject({ clientRequestId: z.uuid(), lines: z.array(line).max(100) });

export type OrderInput = { clientRequestId: string; lines: RequestedLine[] };

export function parseOrderInput(raw: unknown): Result<OrderInput> {
  const r = schema.safeParse(raw);
  if (!r.success) return err("VALIDATION", undefined, { issues: r.error.issues.length });
  return ok({
    clientRequestId: r.data.clientRequestId,
    lines: r.data.lines.map((l) => ({
      recipeId: l.recipeId,
      quantity: l.quantity,
      unitPrice: d(l.unitPrice),
      addons: l.addons.map((a) => ({ addonId: a.addonId, times: a.times, unitPrice: d(a.unitPrice) })),
      removals: l.removals,
    })),
  });
}

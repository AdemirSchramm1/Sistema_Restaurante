import { z } from "zod";
import type { RequestedLine } from "@/domain/ordering/checkout";
import { d } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";

/**
 * Entrada do pedido lançado pela equipe (spec 015, contracts/use-cases.md). Só formato, como o
 * envio do QR code; a observação para a cozinha entra aqui e o tamanho é conferido no domínio.
 */
const money = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/);
const ref = z.strictObject({ kind: z.enum(["ITEM", "RECIPE"]), id: z.uuid() });
const line = z.strictObject({
  recipeId: z.uuid(),
  quantity: z.number(),
  unitPrice: money,
  addons: z.array(z.strictObject({ addonId: z.uuid(), times: z.number(), unitPrice: money })).max(20),
  removals: z.array(ref).max(20),
  kitchenNote: z.string().max(1000).nullable(),
});
const schema = z.strictObject({
  tableId: z.uuid(),
  clientRequestId: z.uuid(),
  tabIdSeen: z.uuid().nullable(),
  lines: z.array(line).max(100),
});

export type StaffOrderInput = {
  tableId: string;
  clientRequestId: string;
  tabIdSeen: string | null;
  lines: (RequestedLine & { kitchenNote: string | null })[];
};

export function parseStaffOrderInput(raw: unknown): Result<StaffOrderInput> {
  const r = schema.safeParse(raw);
  if (!r.success) return err("VALIDATION", undefined, { issues: r.error.issues.length });
  return ok({
    tableId: r.data.tableId,
    clientRequestId: r.data.clientRequestId,
    tabIdSeen: r.data.tabIdSeen,
    lines: r.data.lines.map((l) => ({
      recipeId: l.recipeId,
      quantity: l.quantity,
      unitPrice: d(l.unitPrice),
      addons: l.addons.map((a) => ({ addonId: a.addonId, times: a.times, unitPrice: d(a.unitPrice) })),
      removals: l.removals,
      kitchenNote: l.kitchenNote,
    })),
  });
}

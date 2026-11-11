import type { Deps, Repos } from "../ports";
import type { RequestContext } from "../context";
import { writeMovement } from "./movements";
import { consumptionFor } from "../ordering/order-consumption";
import { planSale } from "@/domain/inventory/movement";
import { err, ok, type Result } from "@/domain/shared/result";

/**
 * Baixa automática pelo pedido (spec 011, US4; entrega a 005 do roadmap). Roda dentro da transação
 * de quem muda a situação do pedido: se algo falhar, nem a baixa nem a mudança ficam.
 */

/**
 * "Começar preparo": uma saída por venda por item do consumo do pedido (010), pelo custo médio do
 * momento, com o pedido de referência. Trava os itens em ordem de id (duas baixas ao mesmo tempo
 * não se travam). O que arredonda para zero na precisão do livro não sai.
 */
export async function recordOrderSale(
  deps: Deps,
  ctx: RequestContext,
  repos: Repos,
  orderId: string,
): Promise<Result<{ movementIds: string[] }>> {
  const used = await consumptionFor(repos, orderId);
  if (!used.ok) return used;
  const movementIds: string[] = [];
  for (const itemId of [...used.value.keys()].sort()) {
    const item = await repos.movements.lockItem(itemId);
    if (!item) return err("NOT_FOUND", "itemId");
    const plan = planSale(item, used.value.get(itemId)!);
    if (!plan.ok) {
      if (plan.error.code === "INVALID_QUANTITY") continue;
      return plan;
    }
    movementIds.push(
      await writeMovement(
        deps,
        ctx,
        repos,
        {
          type: "SALE_RECIPE",
          itemId,
          orderId,
          reasonId: null,
          notes: null,
          occurredAt: deps.clock.now(),
          reversesId: null,
          approvedBy: null,
          idempotencyKey: null,
        },
        plan.value,
      ),
    );
  }
  return ok({ movementIds });
}

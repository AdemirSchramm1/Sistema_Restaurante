import type { Deps, Repos } from "../ports";
import type { RequestContext } from "../context";
import { writeMovement } from "./movements";
import { consumptionFor } from "../ordering/order-consumption";
import { planCancelledSale, planSale } from "@/domain/inventory/movement";
import { reasonByCode } from "@/domain/inventory/movement-reasons";
import { ok, type Result } from "@/domain/shared/result";

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
    // O consumo só traz itens que existem (as linhas apontam para eles).
    const item = (await repos.movements.lockItem(itemId))!;
    const plan = planSale(item, used.value.get(itemId)!);
    // A venda só recusa quantidade que arredonda para zero na precisão do livro: essa não sai.
    if (!plan.ok) continue;
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

/**
 * Pedido cancelado depois do preparo (spec 011, US5): estorna cada venda do pedido e, se os
 * ingredientes foram usados, lança a mesma saída como perda "Pedido cancelado" (mesmo item,
 * quantidade e custo). Nada é editado nem apagado; a perda não é barrada por saldo.
 */
export async function reverseOrderSale(
  deps: Deps,
  ctx: RequestContext,
  repos: Repos,
  orderId: string,
  ingredientsUsed: boolean,
): Promise<string[]> {
  const reasons = {
    reversal: reasonByCode("REVERSAL", "ORDER_CANCELLED"),
    loss: reasonByCode("LOSS", "ORDER_CANCELLED"),
  };
  const sales = (await repos.movements.salesForOrder(orderId)).sort((a, b) =>
    a.itemId.localeCompare(b.itemId),
  );
  const movementIds: string[] = [];
  for (const sale of sales) {
    // A venda aponta para um item que existe (chave estrangeira).
    const item = (await repos.movements.lockItem(sale.itemId))!;
    const plan = planCancelledSale({ type: "SALE_RECIPE", ...sale }, item, ingredientsUsed, reasons);
    // Tipo e motivos são fixos aqui: a única recusa é venda já estornada, que fica como está.
    if (!plan.ok) continue;
    const common = { itemId: item.id, orderId, notes: null, approvedBy: null, idempotencyKey: null };
    const at = deps.clock.now();
    movementIds.push(
      await writeMovement(
        deps,
        ctx,
        repos,
        { ...common, type: "REVERSAL", reasonId: reasons.reversal!.id, occurredAt: at, reversesId: sale.id },
        plan.value.reversal,
      ),
    );
    if (plan.value.loss)
      movementIds.push(
        await writeMovement(
          deps,
          ctx,
          repos,
          { ...common, type: "LOSS", reasonId: reasons.loss!.id, occurredAt: at, reversesId: null },
          plan.value.loss,
        ),
      );
  }
  return movementIds;
}

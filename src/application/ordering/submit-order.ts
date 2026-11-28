import type { Deps } from "../ports";
import { accessFromCookie, loadAccess, type MenuCookies } from "./menu-access";
import { parseOrderInput } from "./order-input";
import { saveOrder } from "./save-order";
import { canSubmitWith, ordersLimit } from "@/domain/ordering/menu-access";
import { businessDay } from "@/domain/ordering/business-day";
import { checkOrder } from "@/domain/ordering/checkout";
import { err, ok, type Result } from "@/domain/shared/result";

/**
 * Enviar pedido pelo celular (spec 009 US2, spec 010 US3; contracts/public-routes.md) ou pelo tablet
 * fixo na mesa (spec 016, US4): no tablet, sem prazo e sem o limite de pedidos.
 */

export type SubmitOrderResult = { orderId: string; number: number; total: string; status: "RECEIVED" };

/**
 * O acesso vem só do cookie. Conferências na ordem do contrato, todas na mesma transação; nada é
 * gravado se algo mudou (indisponível, escolha que saiu, preço).
 */
export async function submitOrder(
  deps: Deps,
  cookie: MenuCookies,
  raw: unknown,
): Promise<Result<SubmitOrderResult>> {
  const input = parseOrderInput(raw);
  if (!input.ok) return input;
  const found = await accessFromCookie(deps, cookie);
  if (!found.ok) return found;

  return deps.tenant(found.value.restaurantId, async (repos) => {
    const loaded = await loadAccess(repos, found.value.menuAccessId);
    if (!loaded.ok) return loaded;
    const { access, table, settings } = loaded.value;
    const now = deps.clock.now();
    // Tablet liberado ou com link trocado (spec 016).
    if (access.endReason === "RELEASED") return err("TABLET_RELEASED");
    if (access.endReason === "LINK_ROTATED") return err("TABLET_LINK_INVALID");
    // Conta fechada pelo caixa (spec 011): o celular precisa ler o QR code de novo.
    if (access.endReason === "TAB_CLOSED") return err("TABLE_TAB_CLOSED");
    if (!canSubmitWith(access, now)) return err("ACCESS_EXPIRED");

    const same = await repos.orders.findByClientRequest(access.id, input.value.clientRequestId);
    if (same) return ok(view(same.id, same.number, same.total.toFixed(2)));
    if (!table.active) return err("TABLE_INACTIVE");
    if (!settings.acceptingQrOrders) return err("ORDERING_PAUSED");

    const today = businessDay(now, settings.timezone);
    const sent = ordersLimit(access.kind) === null ? 0 : await repos.orders.countForAccess(access.id);
    const catalog = await repos.menu.catalog(
      input.value.lines.map((l) => l.recipeId),
      today,
    );
    const priced = checkOrder(input.value.lines, catalog, sent);
    if (!priced.ok) return priced;

    const saved = await saveOrder(deps, repos, {
      tableId: table.id,
      origin: { source: access.kind, menuAccessId: access.id },
      clientRequestId: input.value.clientRequestId,
      businessDay: today,
      now,
      lines: priced.value,
    });
    if (!saved) {
      // Outro toque com o mesmo id chegou primeiro e já gravou: o índice único só recusa pedido que existe.
      const first = (await repos.orders.findByClientRequest(access.id, input.value.clientRequestId))!;
      return ok(view(first.id, first.number, first.total.toFixed(2)));
    }
    return ok(view(saved.orderId, saved.number, saved.total.toFixed(2)));
  });
}

const view = (orderId: string, number: number, total: string): SubmitOrderResult => ({
  orderId,
  number,
  total,
  status: "RECEIVED",
});

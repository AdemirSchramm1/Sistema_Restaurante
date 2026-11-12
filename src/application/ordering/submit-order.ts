import type { Deps } from "../ports";
import { accessFromCookie, loadAccess } from "./menu-access";
import { parseOrderInput } from "./order-input";
import { canSubmitWith } from "@/domain/ordering/menu-access";
import { businessDay } from "@/domain/ordering/business-day";
import { checkOrder } from "@/domain/ordering/checkout";
import { orderTotal } from "@/domain/ordering/order-lines";
import { err, ok, type Result } from "@/domain/shared/result";

/** Enviar pedido pelo celular (spec 009 US2, spec 010 US3; contracts/public-routes.md). */

export type SubmitOrderResult = { orderId: string; number: number; total: string; status: "RECEIVED" };

/**
 * O acesso vem só do cookie. Conferências na ordem do contrato, todas na mesma transação; nada é
 * gravado se algo mudou (indisponível, escolha que saiu, preço).
 */
export async function submitOrder(
  deps: Deps,
  cookie: string | null,
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
    // Conta fechada pelo caixa (spec 011): o celular precisa ler o QR code de novo.
    if (access.endReason === "TAB_CLOSED") return err("TABLE_TAB_CLOSED");
    if (!canSubmitWith(access, now)) return err("ACCESS_EXPIRED");

    const same = await repos.orders.findByClientRequest(access.id, input.value.clientRequestId);
    if (same) return ok(view(same.id, same.number, same.total.toFixed(2)));
    if (!table.active) return err("TABLE_INACTIVE");
    if (!settings.acceptingQrOrders) return err("ORDERING_PAUSED");

    const today = businessDay(now, settings.timezone);
    const sent = await repos.orders.countForAccess(access.id);
    const catalog = await repos.menu.catalog(
      input.value.lines.map((l) => l.recipeId),
      today,
    );
    const priced = checkOrder(input.value.lines, catalog, sent);
    if (!priced.ok) return priced;

    const orderId = deps.ids.next();
    const total = orderTotal(priced.value);
    // Conta da mesa (spec 011, FR-001): abre no primeiro pedido, com a taxa do restaurante de agora.
    const rate = (await repos.billingSettings.get()).serviceChargeRate;
    const tab = await repos.tabs.openForOrder(table.id, now, rate);
    if (tab.opened)
      await repos.tabs.addEvent({
        id: deps.ids.next(),
        tabId: tab.id,
        kind: "OPENED",
        details: { orderId },
        userId: null,
        at: now,
      });
    const saved = await repos.orders.insert({
      id: orderId,
      tableId: table.id,
      tabId: tab.id,
      menuAccessId: access.id,
      clientRequestId: input.value.clientRequestId,
      businessDay: today,
      total,
      submittedAt: now,
      lines: priced.value,
    });
    if (!saved) {
      // Outro toque com o mesmo id chegou primeiro: devolve aquele pedido.
      const first = await repos.orders.findByClientRequest(access.id, input.value.clientRequestId);
      return first ? ok(view(first.id, first.number, first.total.toFixed(2))) : err("STALE_RECORD");
    }
    return ok(view(orderId, saved.number, total.toFixed(2)));
  });
}

const view = (orderId: string, number: number, total: string): SubmitOrderResult => ({
  orderId,
  number,
  total,
  status: "RECEIVED",
});

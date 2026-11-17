import type { Deps, Repos } from "../ports";
import type { NewOrder } from "./ports";
import type { PricedLine } from "@/domain/ordering/checkout";
import { orderTotal } from "@/domain/ordering/order-lines";
import type { Decimal } from "@/domain/shared/decimal";

/**
 * Grava o pedido já conferido, do QR code (009) ou da equipe (015): conta aberta da mesa (abre
 * uma com a taxa de agora; spec 011, FR-001), número do dia, pedido, linhas e o evento Recebido.
 * O `OPENED` da conta leva quem lançou (spec 015, FR-007). `null`: o mesmo envio chegou primeiro
 * por outro toque (nada do pedido fica gravado).
 */
export async function saveOrder(
  deps: Deps,
  repos: Repos,
  input: {
    tableId: string;
    origin: NewOrder["origin"];
    clientRequestId: string;
    businessDay: string;
    now: Date;
    lines: PricedLine[];
  },
): Promise<{ orderId: string; number: number; total: Decimal; tabId: string } | null> {
  const orderId = deps.ids.next();
  const total = orderTotal(input.lines);
  const rate = (await repos.billingSettings.get()).serviceChargeRate;
  const tab = await repos.tabs.openForOrder(input.tableId, input.now, rate);
  if (tab.opened)
    await repos.tabs.addEvent({
      id: deps.ids.next(),
      tabId: tab.id,
      kind: "OPENED",
      details: { orderId },
      userId: input.origin.source === "STAFF" ? input.origin.placedBy : null,
      at: input.now,
    });
  const saved = await repos.orders.insert({
    id: orderId,
    tableId: input.tableId,
    tabId: tab.id,
    origin: input.origin,
    clientRequestId: input.clientRequestId,
    businessDay: input.businessDay,
    total,
    submittedAt: input.now,
    lines: input.lines,
  });
  return saved ? { orderId, number: saved.number, total, tabId: tab.id } : null;
}

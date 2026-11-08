import type { AccessOrderView } from "@/application/ordering/menu";
import { ORDER_STATUS_LABELS } from "@/domain/ordering/order";
import { brl } from "./cart-state";
import { LineChanges } from "./line-changes";

/** "Meus pedidos": só os pedidos deste celular, com a situação de cada um (spec 009, US2). */
export function MyOrders({ orders }: { orders: readonly AccessOrderView[] }) {
  if (!orders.length) return null;
  return (
    <section className="grid gap-3" aria-label="Meus pedidos">
      <h2 className="text-lg font-semibold">Meus pedidos</h2>
      <ul className="grid gap-3">
        {orders.map((o) => (
          <li key={o.number} className="grid gap-1 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">Pedido nº {o.number}</span>
              <span className="rounded bg-muted px-2 py-0.5 text-sm font-medium">{ORDER_STATUS_LABELS[o.status]}</span>
            </div>
            <ul className="grid gap-1 text-sm">
              {o.lines.map((l, i) => (
                <li key={i}>
                  {l.quantity} × {l.productName}
                  <LineChanges changes={l.changes} />
                </li>
              ))}
            </ul>
            <span className="text-sm text-muted-foreground">{brl(o.total)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

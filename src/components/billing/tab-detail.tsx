import type { CancelReason, OrderStatus } from "@/domain/ordering/order";
import { CANCEL_REASON_LABELS, ORDER_STATUS_LABELS } from "@/domain/ordering/order";
import type { CloseBlocker } from "@/domain/billing/tab";
import { PAYMENT_METHOD_LABELS, isPaymentMethod, type PaymentMethod } from "@/domain/billing/payment";
import { d } from "@/domain/shared/decimal";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { brl } from "@/components/ordering/format";
import { KitchenNote, LineChanges } from "@/components/ordering/line-changes";
import { placedByText } from "@/components/staff-ordering/format";
import { pendingText, percent, timeIn } from "./format";

/** Conta da mesa como a tela recebe: dinheiro em string decimal, datas em ISO. */
export type TabDetailView = {
  id: string;
  tableName: string;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt: string | null;
  closedByName: string | null;
  orders: {
    id: string;
    number: number;
    status: OrderStatus;
    cancelReason: CancelReason | null;
    cancelNote: string | null;
    total: string;
    /** Quem lançou (spec 015): sem a origem, a tela não diz. */
    source?: "QR" | "STAFF";
    placedByName?: string | null;
    lines: {
      quantity: number;
      productName: string;
      unitPrice: string;
      changes: string[];
      kitchenNote?: string | null;
    }[];
  }[];
  subtotal: string;
  serviceRate: string | null;
  serviceWaived: boolean;
  serviceCharge: string;
  total: string;
  paid: string;
  remaining: string;
  pendingOrders: number;
  blockers: CloseBlocker[];
  payments: {
    id: string;
    method: PaymentMethod;
    amount: string;
    received: string | null;
    change: string | null;
    at: string;
    byName: string | null;
    removedAt: string | null;
    removedByName: string | null;
  }[];
  events: {
    kind: string;
    reason: string | null;
    details?: Record<string, unknown> | null;
    userName: string | null;
    at: string;
  }[];
};

type Order = TabDetailView["orders"][number];
type TabEvent = TabDetailView["events"][number];

const money = (v: unknown) => (typeof v === "string" ? brl(d(v)) : "");
const method = (v: unknown) => (isPaymentMethod(v) ? PAYMENT_METHOD_LABELS[v] : "");

/** Data local "11/11/2026". */
const dateIn = (at: string, timeZone: string) => new Date(at).toLocaleDateString("pt-BR", { timeZone });

function eventText(e: TabEvent): string {
  const x = e.details ?? {};
  switch (e.kind) {
    case "OPENED":
      return "Conta aberta pelo primeiro pedido";
    case "PAYMENT_ADDED":
      return `Pagamento lançado: ${money(x.amount)}, ${method(x.method)}`;
    case "PAYMENT_REMOVED":
      return `Pagamento tirado: ${money(x.amount)}, ${method(x.method)}`;
    case "SERVICE_WAIVED":
      return "Taxa de serviço tirada";
    case "SERVICE_RESTORED":
      return "Taxa de serviço posta de volta";
    case "CLOSED":
      return `Conta fechada: ${money(x.total)}`;
    case "REOPENED":
      return `Conta reaberta. Motivo: ${e.reason ?? ""}`;
    default:
      return e.kind;
  }
}

function OrderBlock({ order }: { order: Order }) {
  const cancelled = order.status === "CANCELLED";
  const total = brl(d(order.total));
  return (
    <article
      aria-label={cancelled ? `Pedido ${order.number} (cancelado)` : `Pedido ${order.number}`}
      className={`grid gap-2 rounded-md border border-border p-3 ${cancelled ? "text-muted-foreground" : ""}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Pedido {order.number}</h3>
        {order.source && (
          <span className="text-sm text-muted-foreground">
            {placedByText({ source: order.source, placedByName: order.placedByName ?? null })}
          </span>
        )}
        {cancelled ? (
          <span className="text-sm font-medium">
            {`Cancelado: ${order.cancelReason ? CANCEL_REASON_LABELS[order.cancelReason] : ""}${order.cancelNote ? ` (${order.cancelNote})` : ""}`}
          </span>
        ) : (
          <Badge tone={order.status === "DELIVERED" ? "success" : "warning"}>
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
        )}
      </header>
      <ul className="grid gap-1">
        {order.lines.map((l, i) => (
          <li key={i}>
            <div className="flex justify-between gap-2">
              <span>{`${l.quantity} × ${l.productName}`}</span>
              <span className="text-sm text-muted-foreground">{`${brl(d(l.unitPrice))} cada`}</span>
            </div>
            <LineChanges changes={l.changes} />
            <KitchenNote note={l.kitchenNote} />
          </li>
        ))}
      </ul>
      <p className="flex justify-between gap-2 border-t border-border pt-2 font-medium">
        <span>Total do pedido</span>
        {cancelled ? <del>{total}</del> : <span>{total}</span>}
      </p>
    </article>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr className={strong ? "text-lg font-semibold" : ""}>
      <th scope="row" className="py-1 text-left font-normal">
        {label}
      </th>
      <td className="py-1 text-right tabular-nums">{value}</td>
    </tr>
  );
}

/**
 * Conta da mesa (spec 011, US1): pedidos com as mudanças do cliente, cancelados riscados e fora do
 * total, subtotal, taxa de serviço, total, pago e falta, e o histórico.
 */
export function TabDetail({
  tab,
  timezone,
  children,
}: {
  tab: TabDetailView;
  timezone: string;
  /** Pagamentos e botões do caixa, logo abaixo do total. */
  children?: React.ReactNode;
}) {
  const remaining = d(tab.remaining);
  const overpaid = remaining.isNegative();
  const closedText =
    tab.closedAt &&
    [
      dateIn(tab.closedAt, timezone) === dateIn(tab.openedAt, timezone)
        ? `Fechada às ${timeIn(tab.closedAt, timezone)}`
        : `Fechada em ${dateIn(tab.closedAt, timezone)} às ${timeIn(tab.closedAt, timezone)}`,
      tab.closedByName ? ` por ${tab.closedByName}` : "",
    ].join("");

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        {`Aberta em ${dateIn(tab.openedAt, timezone)} às ${timeIn(tab.openedAt, timezone)}`}
      </p>
      {closedText && <p className="font-medium">{closedText}</p>}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="grid content-start gap-3">
          <CardTitle>Pedidos</CardTitle>
          {tab.pendingOrders > 0 && (
            <p className="text-sm font-medium text-warning-soft-foreground">
              {pendingText(tab.pendingOrders)}
            </p>
          )}
          {tab.orders.map((o) => (
            <OrderBlock key={o.id} order={o} />
          ))}
        </Card>

        <div className="grid content-start gap-4">
          <Card className="grid gap-2">
            <section aria-label="Total da conta">
              <CardTitle>Total da conta</CardTitle>
              <table className="mt-2 w-full">
                <tbody>
                  <Row label="Subtotal" value={brl(d(tab.subtotal))} />
                  {tab.serviceRate !== null && (
                    <Row
                      label={`Serviço ${percent(tab.serviceRate)}${tab.serviceWaived ? " (tirado)" : ""}`}
                      value={brl(d(tab.serviceCharge))}
                    />
                  )}
                  <Row label="Total" value={brl(d(tab.total))} strong />
                  <Row label="Pago" value={brl(d(tab.paid))} />
                  {overpaid ? (
                    <Row label="Pago a mais" value={brl(remaining.abs())} strong />
                  ) : (
                    <Row label="Falta" value={brl(remaining)} strong />
                  )}
                </tbody>
              </table>
            </section>
            {overpaid && (
              <Alert tone="error">
                <p>O que foi pago passou do total da conta (um pedido foi cancelado depois do pagamento).</p>
                <p>Tire um pagamento e lance de novo com o valor certo.</p>
              </Alert>
            )}
          </Card>

          {children}

          <Card className="grid gap-2">
            <CardTitle>Histórico da conta</CardTitle>
            <ol className="grid gap-1 text-sm">
              {tab.events.map((e, i) => (
                <li key={i}>
                  {`${timeIn(e.at, timezone)} · ${eventText(e)} · ${e.userName ?? "Cliente pelo QR code"}`}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { d } from "@/domain/shared/decimal";
import { brl } from "@/components/ordering/format";
import { LineChanges } from "@/components/ordering/line-changes";
import type { TabDetailView } from "./tab-detail";
import { percent, timeIn } from "./format";

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr className={strong ? "font-semibold" : ""}>
      <th scope="row" className="py-0.5 text-left font-normal">
        {label}
      </th>
      <td className="py-0.5 text-right tabular-nums">{value}</td>
    </tr>
  );
}

/**
 * Conta para imprimir (spec 011, US1-9): folha simples, sem botões. Pedidos cancelados não saem,
 * porque não são cobrados. Não é documento fiscal.
 */
export function TabPrint({
  tab,
  restaurantName,
  timezone,
  printedAt,
}: {
  tab: TabDetailView;
  restaurantName: string;
  timezone: string;
  printedAt: string;
}) {
  const lines = tab.orders.filter((o) => o.status !== "CANCELLED").flatMap((o) => o.lines);
  const paid = d(tab.paid);
  const remaining = d(tab.remaining);
  const date = new Date(printedAt).toLocaleDateString("pt-BR", { timeZone: timezone });
  return (
    <article className="tab-print mx-auto grid max-w-sm gap-3 font-mono text-sm" aria-label={`Conta da mesa ${tab.tableName}`}>
      <header className="grid gap-0.5 text-center">
        <h1 className="text-base font-bold">{restaurantName}</h1>
        <p>{`Mesa ${tab.tableName}`}</p>
        <p>{`${date} ${timeIn(printedAt, timezone)}`}</p>
      </header>
      <ul className="grid gap-1 border-y border-dashed border-foreground py-2">
        {lines.map((l, i) => (
          <li key={i}>
            <div data-line className="flex justify-between gap-2">
              <span>{`${l.quantity} × ${l.productName}`}</span>
              <span className="tabular-nums">{brl(d(l.unitPrice).times(l.quantity))}</span>
            </div>
            <LineChanges changes={l.changes} />
          </li>
        ))}
      </ul>
      <table className="w-full">
        <tbody>
          <Row label="Subtotal" value={brl(d(tab.subtotal))} />
          {tab.serviceRate !== null && (
            <Row
              label={`Serviço ${percent(tab.serviceRate)}${tab.serviceWaived ? " (tirado)" : ""}`}
              value={brl(d(tab.serviceCharge))}
            />
          )}
          <Row label="Total" value={brl(d(tab.total))} strong />
          {!paid.isZero() && <Row label="Pago" value={brl(paid)} />}
          {!paid.isZero() && <Row label="Falta" value={brl(remaining.isNegative() ? d(0) : remaining)} strong />}
        </tbody>
      </table>
      <p className="text-center font-semibold">Não é documento fiscal</p>
    </article>
  );
}

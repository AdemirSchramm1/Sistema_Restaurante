import Link from "next/link";
import { d } from "@/domain/shared/decimal";
import { brl } from "@/components/ordering/format";
import { pendingText, sinceText } from "./format";

export type OpenTabCard = {
  id: string;
  tableName: string;
  openedAt: string;
  total: string;
  remaining: string;
  pendingOrders: number;
};

/** O que falta pagar, em texto (não só cor). Nada pago ainda: só o total aparece. */
function paidState(t: OpenTabCard): string | null {
  const remaining = d(t.remaining);
  if (remaining.isZero()) return "Pago";
  if (remaining.isNegative()) return "Pago a mais";
  return remaining.equals(d(t.total)) ? null : `Falta ${brl(remaining)}`;
}

/** Caixa (spec 011, US1): mesas com conta aberta, a mais antiga primeiro. */
export function OpenTabs({ tabs, serverNow }: { tabs: OpenTabCard[]; serverNow: string }) {
  if (!tabs.length) return <p className="text-muted-foreground">Nenhuma mesa com conta aberta.</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tabs.map((t) => {
        const state = paidState(t);
        return (
          <li key={t.id}>
            <Link
              href={`/caixa/${t.id}`}
              className="grid gap-1 rounded-lg border border-border p-4 hover:border-primary focus-visible:outline-2"
            >
              <span className="flex items-baseline justify-between gap-2">
                <strong className="text-xl">Mesa {t.tableName}</strong>
                <span className="text-sm text-muted-foreground">{sinceText(t.openedAt, serverNow)}</span>
              </span>
              <span className="text-lg font-semibold">{brl(d(t.total))}</span>
              {state && <span className="text-sm font-medium">{state}</span>}
              {t.pendingOrders > 0 && (
                <span className="text-sm font-medium text-warning-soft-foreground">
                  {pendingText(t.pendingOrders)}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

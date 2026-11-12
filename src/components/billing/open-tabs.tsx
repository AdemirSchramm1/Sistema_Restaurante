import Link from "next/link";
import { CookingPot, Wallet } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
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
  if (!tabs.length)
    return (
      <EmptyState icon={Wallet} title="Nenhuma mesa com conta aberta.">
        A conta abre sozinha no primeiro pedido da mesa.
      </EmptyState>
    );
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tabs.map((t) => {
        const state = paidState(t);
        return (
          <li key={t.id}>
            <Link
              href={`/caixa/${t.id}`}
              className="grid gap-1.5 rounded-xl border border-border bg-card p-4 shadow-xs transition hover:border-primary hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="flex items-baseline justify-between gap-2">
                <strong className="font-display text-2xl font-semibold">Mesa {t.tableName}</strong>
                <span className="text-sm text-muted-foreground">{sinceText(t.openedAt, serverNow)}</span>
              </span>
              <span className="text-xl font-semibold tabular-nums">{brl(d(t.total))}</span>
              {state && <span className="text-sm font-medium">{state}</span>}
              {t.pendingOrders > 0 && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-warning-soft-foreground">
                  <CookingPot aria-hidden="true" className="size-4" />
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

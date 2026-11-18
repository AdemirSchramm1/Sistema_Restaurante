import type { ActionState } from "@/actions/_session";
import { HandPlatter } from "lucide-react";
import { ActionForm } from "@/components/forms/action-form";
import { EmptyState } from "@/components/ui/empty-state";
import { KitchenNote, LineChanges } from "./line-changes";
import { tableWithSource, type OrderSource } from "@/domain/ordering/order";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

export type ReadyOrderView = {
  id: string;
  number: number;
  tableName: string;
  readyAt: string;
  version: number;
  /** "João" ou "QR code" (spec 015, FR-017). */
  placedBy?: string;
  /** O pedido do tablet mostra "Mesa 12 · tablet" (spec 016, FR-008). */
  source?: OrderSource;
  lines: { quantity: number; productName: string; changes: string[]; kitchenNote?: string | null }[];
};

/** Tela do garçom (spec 009 US4): pedidos prontos com a mesa em destaque e "Entregue". */
export function ReadyList({ orders, deliver }: { orders: ReadyOrderView[]; deliver: Action }) {
  if (!orders.length)
    return (
      <EmptyState icon={HandPlatter} title="Nenhum pedido pronto para levar.">
        Quando a cozinha terminar um pedido, ele aparece aqui.
      </EmptyState>
    );
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {orders.map((o) => (
        <li key={o.id}>
          <article
            aria-label={`Mesa ${tableWithSource(o.tableName, o.source ?? "QR")}, pedido ${o.number}`}
            className="grid gap-3 rounded-xl border border-l-4 border-border border-l-success bg-card p-5 shadow-sm"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-3xl font-semibold">Mesa {tableWithSource(o.tableName, o.source ?? "QR")}</h2>
              <span className="text-sm text-muted-foreground">Pedido {o.number}</span>
            </div>
            {o.placedBy && <p className="text-sm font-medium">{o.placedBy}</p>}
            <ul className="grid gap-1.5 text-base">
              {o.lines.map((l, i) => (
                <li key={i}>
                  <span className="font-medium">
                    {l.quantity} × {l.productName}
                  </span>
                  <LineChanges changes={l.changes} />
                  <KitchenNote note={l.kitchenNote} />
                </li>
              ))}
            </ul>
            <ActionForm
              action={deliver}
              hidden={{ id: o.id, version: o.version }}
              submitLabel="Entregue"
              variant="success"
              size="xl"
              className="grid"
            />
          </article>
        </li>
      ))}
    </ul>
  );
}

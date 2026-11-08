import type { ActionState } from "@/actions/_session";
import { ActionForm } from "@/components/forms/action-form";
import { LineChanges } from "./line-changes";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

export type ReadyOrderView = {
  id: string;
  number: number;
  tableName: string;
  readyAt: string;
  version: number;
  lines: { quantity: number; productName: string; changes: string[] }[];
};

/** Tela do garçom (spec 009 US4): pedidos prontos com a mesa em destaque e "Entregue". */
export function ReadyList({ orders, deliver }: { orders: ReadyOrderView[]; deliver: Action }) {
  if (!orders.length) return <p className="text-muted-foreground">Nenhum pedido pronto para levar.</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {orders.map((o) => (
        <li key={o.id}>
          <article aria-label={`Mesa ${o.tableName}, pedido ${o.number}`} className="grid gap-2 rounded-lg border-2 border-primary p-4">
            <h2 className="text-3xl font-bold">Mesa {o.tableName}</h2>
            <span className="text-sm text-muted-foreground">Pedido {o.number}</span>
            <ul className="grid gap-1">
              {o.lines.map((l, i) => (
                <li key={i}>
                  <span className="font-medium">
                    {l.quantity} × {l.productName}
                  </span>
                  <LineChanges changes={l.changes} />
                </li>
              ))}
            </ul>
            <ActionForm action={deliver} hidden={{ id: o.id, version: o.version }} submitLabel="Entregue" variant="default" />
          </article>
        </li>
      ))}
    </ul>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { ClipboardList } from "lucide-react";
import type { ActionState } from "@/actions/_session";
import type { TableOrdersView, TableOrderView } from "@/application/ordering/staff-orders";
import { CANCEL_REASONS, CANCEL_REASON_LABELS, ORDER_STATUS_LABELS } from "@/domain/ordering/order";
import type { ReorderSource } from "@/domain/ordering/reorder";
import { ActionForm } from "@/components/forms/action-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { brl } from "@/components/ordering/format";
import { KitchenNote, LineChanges } from "@/components/ordering/line-changes";
import { placedByText, STATUS_TONES } from "./format";

type FormAction = (prev: ActionState, form: FormData) => Promise<ActionState>;

const time = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit" });

const againOf = (o: TableOrderView): ReorderSource[] =>
  o.lines.map((l) => ({ ...l.again, productName: l.productName }));

/** Cancelar o próprio pedido em Recebido (spec 015, US4): motivo da lista, "Outro" pede texto. */
function CancelOwn({ order, cancel }: { order: TableOrderView; cancel: FormAction }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("ENTERED_BY_MISTAKE");
  if (!open)
    return (
      <Button type="button" variant="ghost" size="lg" onClick={() => setOpen(true)}>
        Cancelar
      </Button>
    );
  return (
    <ActionForm
      action={cancel}
      hidden={{ id: order.id, version: order.version }}
      submitLabel="Cancelar o pedido"
      variant="destructive"
      size="lg"
      aria-label={`Cancelar o pedido ${order.number}`}
      className="grid basis-full gap-2"
    >
      <label className="grid gap-1 text-sm font-medium">
        Por que cancelar?
        <select
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="h-11 rounded-lg border border-input bg-background px-3 text-base"
        >
          {CANCEL_REASONS.map((r) => (
            <option key={r} value={r}>
              {CANCEL_REASON_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      {reason === "OTHER" && (
        <label className="grid gap-1 text-sm font-medium">
          Qual o motivo?
          <input
            name="note"
            required
            maxLength={140}
            className="h-11 rounded-lg border border-input bg-background px-3 text-base"
          />
        </label>
      )}
      <Button type="button" variant="ghost" size="lg" onClick={() => setOpen(false)}>
        Voltar
      </Button>
    </ActionForm>
  );
}

/**
 * Pedidos da mesa (spec 015, US3, US4, US6): os pedidos da conta aberta de todas as origens, com
 * quem lançou, situação, observação, Entregue, Cancelar (o próprio, em Recebido) e Pedir de novo.
 */
export function TableOrders({
  view,
  userId,
  timezone,
  deliver,
  cancel,
  onAgain,
  locked,
}: {
  view: TableOrdersView;
  userId: string;
  timezone: string;
  deliver: FormAction;
  cancel: FormAction;
  onAgain: (lines: ReorderSource[]) => void;
  /** Carrinho travado por envio sem resposta: Pedir de novo espera. */
  locked: boolean;
}) {
  if (!view.tab)
    return (
      <EmptyState icon={ClipboardList} title="Nenhum pedido aberto nesta mesa.">
        Os pedidos da conta aberta aparecem aqui, pelo QR code ou pela equipe.
      </EmptyState>
    );
  return (
    <div className="grid grid-cols-1 gap-4">
      <section aria-label="Conta da mesa" className="grid gap-1 rounded-xl border border-border bg-card p-4">
        <p className="flex flex-wrap justify-between gap-x-3">
          <span>Pedidos</span>
          <span>{brl(view.tab.subtotal)}</span>
        </p>
        {view.tab.serviceCharge !== "0.00" && (
          <p className="flex flex-wrap justify-between gap-x-3">
            <span>Taxa de serviço</span>
            <span>{brl(view.tab.serviceCharge)}</span>
          </p>
        )}
        <p className="flex flex-wrap justify-between gap-x-3 text-lg font-semibold">
          <span>Total da conta</span>
          <span>{brl(view.tab.total)}</span>
        </p>
        <Link
          href={`/caixa/${view.tab.id}`}
          className={buttonVariants({ variant: "outline", size: "lg", className: "justify-self-start" })}
        >
          Ver conta
        </Link>
      </section>
      <ul className="grid grid-cols-1 gap-3" aria-label="Pedidos da mesa">
        {view.orders.map((o) => {
          const cancelled = o.status === "CANCELLED";
          const kitchenStarted =
            o.placedById === userId && !o.canCancel && (o.status === "PREPARING" || o.status === "READY");
          return (
            <li key={o.id}>
              <article
                aria-label={`Pedido ${o.number}`}
                className="grid gap-2 rounded-xl border border-border bg-card p-4 shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className={`font-semibold ${cancelled ? "line-through" : ""}`}>
                    Pedido {o.number} · {time(o.submittedAt, timezone)} · {placedByText(o)}
                  </h3>
                  <Badge tone={STATUS_TONES[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                </div>
                <ul className={`grid gap-1 ${cancelled ? "text-muted-foreground line-through" : ""}`}>
                  {o.lines.map((l, i) => (
                    <li key={i} className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-medium">
                          {l.quantity} × {l.productName}
                        </span>
                        <LineChanges changes={l.changes} />
                        <KitchenNote note={l.kitchenNote} />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="lg"
                        disabled={locked}
                        aria-label={`Pedir de novo ${l.quantity} ${l.productName}`}
                        onClick={() => onAgain([{ ...l.again, productName: l.productName }])}
                      >
                        Pedir de novo
                      </Button>
                    </li>
                  ))}
                </ul>
                <p className="font-semibold">{brl(o.total)}</p>
                {kitchenStarted && (
                  <p className="text-sm text-muted-foreground">
                    A cozinha já começou. Peça ao chef ou ao gerente para cancelar.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    disabled={locked}
                    aria-label={`Pedir de novo o pedido ${o.number}`}
                    onClick={() => onAgain(againOf(o))}
                  >
                    Pedir de novo o pedido
                  </Button>
                  {o.canDeliver && (
                    <ActionForm
                      action={deliver}
                      hidden={{ id: o.id, version: o.version }}
                      submitLabel="Entregue"
                      variant="success"
                      size="lg"
                      aria-label={`Entregar o pedido ${o.number}`}
                    />
                  )}
                  {o.canCancel && <CancelOwn order={o} cancel={cancel} />}
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

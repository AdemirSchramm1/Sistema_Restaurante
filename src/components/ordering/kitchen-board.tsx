"use client";

import { useState } from "react";
import type { ActionState } from "@/actions/_session";
import { ActionForm } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import {
  CANCEL_NOTE_MAX,
  CANCEL_REASONS,
  CANCEL_REASON_LABELS,
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from "@/domain/ordering/order";
import { LineChanges } from "./line-changes";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

export type KitchenOrderView = {
  id: string;
  number: number;
  tableName: string;
  submittedAt: string;
  status: OrderStatus;
  late: boolean;
  version: number;
  lines: { quantity: number; productName: string; changes: string[] }[];
};

const COLUMNS: { status: OrderStatus; title: string }[] = [
  { status: "RECEIVED", title: "Recebidos" },
  { status: "PREPARING", title: "Em preparo" },
  { status: "READY", title: "Prontos" },
];

const minutesAgo = (from: string, now: string) =>
  Math.max(0, Math.floor((Date.parse(now) - Date.parse(from)) / 60_000));

function CancelForm({ order, cancel, onClose }: { order: KitchenOrderView; cancel: Action; onClose: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <ActionForm
      action={cancel}
      hidden={{ id: order.id, version: order.version }}
      submitLabel="Confirmar cancelamento"
      variant="destructive"
      className="grid gap-2 rounded-md border border-border p-2"
      aria-label={`Cancelar pedido ${order.number}`}
    >
      <label className="grid gap-1 text-sm">
        <span>Motivo</span>
        <Select name="reason" value={reason} onChange={(e) => setReason(e.target.value)} required>
          <option value="">Escolha</option>
          {CANCEL_REASONS.map((r) => (
            <option key={r} value={r}>
              {CANCEL_REASON_LABELS[r]}
            </option>
          ))}
        </Select>
      </label>
      {reason === "OTHER" && (
        <label className="grid gap-1 text-sm">
          <span>Qual o motivo?</span>
          <Input name="note" maxLength={CANCEL_NOTE_MAX} required />
        </label>
      )}
      <Button type="button" size="sm" variant="ghost" onClick={onClose}>
        Voltar
      </Button>
    </ActionForm>
  );
}

/**
 * Quadro da cozinha (spec 009 US4): colunas por situação, mais antigo primeiro, "Novo" para o que
 * chegou depois de a tela abrir e "Atrasado" em texto.
 */
export function KitchenBoard({
  orders,
  serverNow,
  advance,
  cancel,
}: {
  orders: KitchenOrderView[];
  serverNow: string;
  advance: Action;
  cancel: Action;
}) {
  // O que já estava na tela quando ela abriu; o resto chegou depois e é "Novo".
  const [seen] = useState(() => new Set(orders.map((o) => o.id)));
  const [cancelling, setCancelling] = useState<string | null>(null);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const list = orders.filter((o) => o.status === col.status);
        return (
          <section key={col.status} className="grid content-start gap-3" aria-label={col.title}>
            <h2 className="text-lg font-semibold">
              {col.title} ({list.length})
            </h2>
            {list.map((o) => {
              const fresh = !seen.has(o.id);
              return (
                <article
                  key={o.id}
                  aria-label={`Pedido ${o.number}, Mesa ${o.tableName}`}
                  className={`grid gap-2 rounded-lg border p-3 ${o.late ? "border-red-400 border-2" : fresh ? "border-primary border-2" : "border-border"}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-xl">Mesa {o.tableName}</strong>
                    <span className="text-sm text-muted-foreground">Pedido {o.number}</span>
                    <span className="text-sm text-muted-foreground">há {minutesAgo(o.submittedAt, serverNow)} min</span>
                    {fresh && <span className="rounded bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">Novo</span>}
                    {o.late && <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900">Atrasado</span>}
                  </div>
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
                  <p className="sr-only">Situação: {ORDER_STATUS_LABELS[o.status]}</p>
                  <div className="flex flex-wrap gap-2">
                    {o.status === "RECEIVED" && (
                      <ActionForm
                        action={advance}
                        hidden={{ id: o.id, version: o.version, to: "PREPARING" }}
                        submitLabel="Começar preparo"
                        variant="default"
                        aria-label={`Começar preparo do pedido ${o.number}`}
                      />
                    )}
                    {o.status === "PREPARING" && (
                      <ActionForm
                        action={advance}
                        hidden={{ id: o.id, version: o.version, to: "READY" }}
                        submitLabel="Pronto"
                        variant="default"
                        aria-label={`Pronto: pedido ${o.number}`}
                      />
                    )}
                    {o.status === "READY" && <span className="text-sm text-muted-foreground">Esperando o garçom</span>}
                    {cancelling !== o.id && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={`Cancelar pedido ${o.number}`}
                        onClick={() => setCancelling(o.id)}
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>
                  {cancelling === o.id && <CancelForm order={o} cancel={cancel} onClose={() => setCancelling(null)} />}
                </article>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

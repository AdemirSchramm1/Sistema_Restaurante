"use client";

import { useState } from "react";
import type { ActionState } from "@/actions/_session";
import { ActionForm } from "@/components/forms/action-form";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import {
  CANCEL_NOTE_MAX,
  CANCEL_REASONS,
  CANCEL_REASON_LABELS,
  ORDER_STATUS_LABELS,
  leftTheShelf,
  type OrderStatus,
} from "@/domain/ordering/order";
import { cn } from "@/lib/utils";
import { KitchenNote, LineChanges } from "./line-changes";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

export type KitchenOrderView = {
  id: string;
  number: number;
  tableName: string;
  submittedAt: string;
  status: OrderStatus;
  late: boolean;
  version: number;
  /** "João" ou "QR code" (spec 015, FR-017). */
  placedBy?: string;
  lines: { quantity: number; productName: string; changes: string[]; kitchenNote?: string | null }[];
};

type StageTone = "warning" | "primary" | "success";

/** Colunas na ordem do preparo, cada uma com a cor da etapa (spec 012, US3). */
const COLUMNS: { status: OrderStatus; title: string; tone: StageTone }[] = [
  { status: "RECEIVED", title: "Recebidos", tone: "warning" },
  { status: "PREPARING", title: "Em preparo", tone: "primary" },
  { status: "READY", title: "Prontos", tone: "success" },
];

const STAGE: Record<StageTone, { dot: string; card: string }> = {
  warning: { dot: "bg-warning", card: "border-l-warning" },
  primary: { dot: "bg-primary", card: "border-l-primary" },
  success: { dot: "bg-success", card: "border-l-success" },
};

const minutesAgo = (from: string, now: string) =>
  Math.max(0, Math.floor((Date.parse(now) - Date.parse(from)) / 60_000));

function CancelForm({
  order,
  cancel,
  onClose,
}: {
  order: KitchenOrderView;
  cancel: Action;
  onClose: () => void;
}) {
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
      {leftTheShelf(order.status) && (
        <fieldset className="grid gap-1 text-sm">
          <legend className="mb-1">Os ingredientes já foram usados?</legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              className="accent-primary"
              name="ingredientsUsed"
              value="true"
              defaultChecked
            />
            Sim, vão para a perda
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" className="accent-primary" name="ingredientsUsed" value="false" />
            Não, voltam para o estoque
          </label>
        </fieldset>
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
    <div className="grid items-start gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const list = orders.filter((o) => o.status === col.status);
        return (
          <section
            key={col.status}
            data-stage={col.tone}
            className="grid content-start gap-3 rounded-2xl bg-muted/60 p-3"
            aria-label={col.title}
          >
            <h2 className="flex items-center gap-2 px-1 text-base font-semibold">
              <span aria-hidden="true" className={cn("size-2.5 rounded-full", STAGE[col.tone].dot)} />
              {col.title}{" "}
              <span className="font-normal tabular-nums text-muted-foreground">({list.length})</span>
            </h2>
            {list.map((o) => {
              const fresh = !seen.has(o.id);
              return (
                <article
                  key={o.id}
                  aria-label={`Pedido ${o.number}, Mesa ${o.tableName}`}
                  className={cn(
                    "grid gap-3 rounded-xl border border-l-4 border-border bg-card p-4 shadow-xs",
                    STAGE[col.tone].card,
                    o.late ? "ring-2 ring-destructive" : fresh && "ring-2 ring-primary",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <strong className="font-display text-2xl font-semibold leading-none">
                      Mesa {o.tableName}
                    </strong>
                    {o.placedBy && <span className="text-sm font-medium">{o.placedBy}</span>}
                    <span className="text-sm text-muted-foreground">Pedido {o.number}</span>
                    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock aria-hidden="true" className="size-3.5" />
                      há {minutesAgo(o.submittedAt, serverNow)} min
                    </span>
                    {fresh && <Badge tone="primary">Novo</Badge>}
                    {o.late && <Badge tone="danger">Atrasado</Badge>}
                  </div>
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
                  <p className="sr-only">Situação: {ORDER_STATUS_LABELS[o.status]}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {o.status === "RECEIVED" && (
                      <ActionForm
                        action={advance}
                        hidden={{ id: o.id, version: o.version, to: "PREPARING" }}
                        submitLabel="Começar preparo"
                        variant="default"
                        size="lg"
                        aria-label={`Começar preparo do pedido ${o.number}`}
                      />
                    )}
                    {o.status === "PREPARING" && (
                      <ActionForm
                        action={advance}
                        hidden={{ id: o.id, version: o.version, to: "READY" }}
                        submitLabel="Pronto"
                        variant="success"
                        size="lg"
                        aria-label={`Pronto: pedido ${o.number}`}
                      />
                    )}
                    {o.status === "READY" && (
                      <span className="text-sm font-medium text-success-soft-foreground">
                        Esperando o garçom
                      </span>
                    )}
                    {cancelling !== o.id && (
                      <Button
                        type="button"
                        size="lg"
                        variant="ghost"
                        aria-label={`Cancelar pedido ${o.number}`}
                        onClick={() => setCancelling(o.id)}
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>
                  {cancelling === o.id && (
                    <CancelForm order={o} cancel={cancel} onClose={() => setCancelling(null)} />
                  )}
                </article>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

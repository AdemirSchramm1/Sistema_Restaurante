"use client";

import { useId, useState } from "react";
import type { ActionState } from "@/actions/_session";
import type { CloseBlocker } from "@/domain/billing/tab";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/domain/billing/payment";
import { d, formatBrDecimal, parseBrDecimal } from "@/domain/shared/decimal";
import { ActionForm } from "@/components/forms/action-form";
import { FormError } from "@/components/forms/form-error";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brl } from "@/components/ordering/format";
import { timeIn } from "./format";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/** "84,70" para o campo de valor. */
const field = (v: string) => formatBrDecimal(d(v), { minPlaces: 2, maxPlaces: 2 });
const parsed = (text: string) => {
  const r = parseBrDecimal(text);
  return r.ok ? r.value : null;
};

/**
 * Lançar pagamento (spec 011, US2-1 a US2-3): forma, valor (já com o que falta) e, no dinheiro, o
 * recebido com o troco. O id do pagamento só muda depois de lançar: o toque duplo manda o mesmo.
 * `fill` é o valor pedido de fora (uma parte da divisão).
 */
export function PaymentForm({
  tabId,
  remaining,
  action,
  fill = null,
  blockedBy,
}: {
  tabId: string;
  remaining: string;
  action: Action;
  fill?: { amount: string; at: number } | null;
  /** Id do aviso que explica por que não dá para lançar (caixa fechado, spec 014). */
  blockedBy?: string;
}) {
  const { state, pending, formProps } = useFormAction(action);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState(() => field(remaining));
  const [received, setReceived] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  // Ajustes quando a conta muda (pagamento lançado, pedido novo) ou quando pedem um valor de fora.
  const [seen, setSeen] = useState({ remaining, fillAt: fill?.at ?? null, state });
  if (seen.remaining !== remaining || seen.fillAt !== (fill?.at ?? null) || seen.state !== state) {
    setSeen({ remaining, fillAt: fill?.at ?? null, state });
    if (seen.remaining !== remaining) {
      setAmount(field(remaining));
      setReceived("");
    }
    if (fill && seen.fillAt !== fill.at) setAmount(field(fill.amount));
    if (seen.state !== state && state?.ok) setRequestId(crypto.randomUUID());
  }

  const value = parsed(amount);
  const given = method === "CASH" ? parsed(received) : null;
  const change = value && given && given.gt(value) ? given.minus(value) : null;

  return (
    <form {...formProps} aria-label="Lançar pagamento" className="grid gap-3">
      <input type="hidden" name="tabId" value={tabId} />
      <input type="hidden" name="clientRequestId" value={requestId} />
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Forma de pagamento</legend>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((m) => (
            <label
              key={m}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-medium transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary-soft-foreground"
            >
              <input
                type="radio"
                className="accent-primary"
                name="method"
                value={m}
                checked={method === m}
                onChange={() => setMethod(m)}
                required
              />
              {PAYMENT_METHOD_LABELS[m]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm font-medium">
          Valor (R$)
          <Input
            name="amount"
            inputMode="decimal"
            className="w-36"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
        {method === "CASH" && (
          <label className="grid gap-1 text-sm font-medium">
            Recebido em dinheiro (R$)
            <Input
              name="received"
              inputMode="decimal"
              className="w-36"
              value={received}
              onChange={(e) => setReceived(e.target.value)}
              placeholder="Opcional"
            />
          </label>
        )}
        <Button type="submit" disabled={pending || Boolean(blockedBy)} aria-describedby={blockedBy}>
          Lançar pagamento
        </Button>
      </div>
      {change && (
        <p role="status" className="text-lg font-semibold">
          {`Troco: ${brl(change)}`}
        </p>
      )}
      <FormError error={state && !state.ok ? state.error : null} />
    </form>
  );
}

/** Motivos que seguram o fechamento, em texto (US2-6). */
function closeReasons(tab: { remaining: string; blockers: CloseBlocker[] }): string[] {
  const remaining = d(tab.remaining);
  return tab.blockers.map((b) =>
    b === "PENDING_ORDERS"
      ? "A mesa tem pedidos que ainda não foram entregues."
      : remaining.isNegative()
        ? `Foi pago ${brl(remaining.abs())} a mais.`
        : `Ainda falta pagar ${brl(remaining)}.`,
  );
}

/** "Fechar conta" só com falta R$ 0,00 e tudo entregue; senão, desabilitado com o motivo. */
export function CloseTabForm({
  tab,
  action,
}: {
  /** `tableName` só serve para o aviso "Conta da Mesa 12 fechada" no Caixa. */
  tab: { id: string; version: number; remaining: string; blockers: CloseBlocker[]; tableName?: string };
  action: Action;
}) {
  const { state, pending, formProps } = useFormAction(action);
  const reasons = closeReasons(tab);
  const reasonsId = `close-reasons-${tab.id}`;
  return (
    <form {...formProps} aria-label="Fechar a conta" className="grid gap-2">
      <input type="hidden" name="tabId" value={tab.id} />
      <input type="hidden" name="version" value={tab.version} />
      {tab.tableName && <input type="hidden" name="tableName" value={tab.tableName} />}
      <Button
        type="submit"
        size="lg"
        disabled={pending || reasons.length > 0}
        aria-describedby={reasons.length ? reasonsId : undefined}
      >
        Fechar conta
      </Button>
      {reasons.length > 0 && (
        <ul id={reasonsId} className="grid gap-0.5 text-sm text-muted-foreground">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      <FormError error={state && !state.ok ? state.error : null} />
    </form>
  );
}

export type PaymentRow = {
  id: string;
  method: PaymentMethod;
  amount: string;
  received: string | null;
  change: string | null;
  at: string;
  byName: string | null;
  removedAt: string | null;
  removedByName: string | null;
};

/**
 * Pagamentos lançados (US2-4): o tirado continua na lista, riscado, com quem tirou e quando.
 * "Tirar" só aparece com `remove` (conta aberta e quem pode receber) e pede confirmação.
 */
export function PaymentList({
  tabId,
  payments,
  timezone,
  remove,
  cashSessionOpen = true,
}: {
  tabId: string;
  payments: PaymentRow[];
  timezone: string;
  remove?: Action;
  /** Tirar pagamento também exige o caixa aberto (spec 014, FR-002). */
  cashSessionOpen?: boolean;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const reasonId = useId();
  if (!payments.length) return <p className="text-sm text-muted-foreground">Nenhum pagamento lançado.</p>;
  const blocked = Boolean(remove) && !cashSessionOpen;
  return (
    <ul className="grid gap-2">
      {blocked && (
        <li id={reasonId} className="text-sm text-muted-foreground">
          Abra o caixa antes de tirar um pagamento.
        </li>
      )}
      {payments.map((p) => {
        const removed = p.removedAt !== null;
        const value = brl(d(p.amount));
        const label = PAYMENT_METHOD_LABELS[p.method];
        return (
          <li
            key={p.id}
            className={`grid gap-1 rounded-md border border-border p-2 text-sm ${removed ? "text-muted-foreground" : ""}`}
          >
            <div className="flex justify-between gap-2">
              <span className="font-medium">{label}</span>
              {removed ? <del>{value}</del> : <strong>{value}</strong>}
            </div>
            {p.received && p.change && (
              <span>{`Recebido ${brl(d(p.received))}, troco ${brl(d(p.change))}`}</span>
            )}
            <span className="text-muted-foreground">{`${timeIn(p.at, timezone)} · ${p.byName ?? ""}`}</span>
            {removed && p.removedAt && (
              <span>{`Tirado às ${timeIn(p.removedAt, timezone)} por ${p.removedByName ?? ""}`}</span>
            )}
            {remove && !removed && confirming !== p.id && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="justify-self-start"
                aria-label={`Tirar pagamento de ${value} (${label})`}
                aria-describedby={blocked ? reasonId : undefined}
                disabled={blocked}
                onClick={() => setConfirming(p.id)}
              >
                Tirar
              </Button>
            )}
            {remove && !removed && confirming === p.id && (
              <ActionForm
                action={remove}
                hidden={{ tabId, paymentId: p.id }}
                submitLabel="Sim, tirar"
                variant="destructive"
                className="flex flex-wrap items-center gap-2"
                aria-label={`Tirar pagamento de ${value} (${label})`}
              >
                <p className="basis-full">{`Tirar o pagamento de ${value} em ${label}?`}</p>
                <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                  Voltar
                </Button>
              </ActionForm>
            )}
          </li>
        );
      })}
    </ul>
  );
}

"use client";

import { useRef, useState } from "react";
import type { ActionState } from "@/actions/_session";
import type { SubmitOrderResult } from "@/application/ordering/submit-order";
import { MAX_LINE_QUANTITY } from "@/domain/ordering/order-lines";
import { Button } from "@/components/ui/button";
import {
  applyPriceChanges,
  brl,
  cartTotal,
  lineChanges,
  lineTotal,
  removeUnavailable,
  setQuantity,
  toOrderLines,
  type CartLine,
  type PriceChanges,
  type Unavailable,
} from "./cart-state";
import { LineChanges } from "./line-changes";

export type SubmitInput = { clientRequestId: string; lines: ReturnType<typeof toOrderLines> };
export type SubmitFn = (input: SubmitInput) => Promise<ActionState<SubmitOrderResult>>;

const newId = () => crypto.randomUUID();

/**
 * Carrinho com resumo de confirmação (spec 009, US2). O `clientRequestId` nasce ao abrir o resumo e
 * vale para toda nova tentativa: toque duplo ou queda de rede não criam pedido em dobro.
 */
export function Cart({
  lines,
  onChange,
  submit,
  onSent,
}: {
  lines: CartLine[];
  onChange: (lines: CartLine[]) => void;
  submit: SubmitFn;
  onSent?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [sent, setSent] = useState<SubmitOrderResult | null>(null);
  const requestId = useRef<string | null>(null);
  const total = cartTotal(lines);

  const open = () => {
    requestId.current ??= newId();
    setMessages([]);
    setSent(null);
    setConfirming(true);
  };

  const confirm = async () => {
    requestId.current ??= newId();
    setSending(true);
    setMessages([]);
    try {
      const r = await submit({ clientRequestId: requestId.current, lines: toOrderLines(lines) });
      if (r?.ok) {
        setSent(r.data);
        setConfirming(false);
        requestId.current = null;
        onChange([]);
        onSent?.();
        return;
      }
      if (!r) return;
      const details = (r.error.details ?? {}) as PriceChanges & Unavailable;
      if (r.error.code === "PRICE_CHANGED") {
        const next = applyPriceChanges(lines, details);
        onChange(next.lines);
        setMessages(next.messages.length ? next.messages : [r.error.message]);
      } else if (r.error.code === "PRODUCT_UNAVAILABLE" || r.error.code === "OPTION_UNAVAILABLE") {
        const next = removeUnavailable(lines, r.error.code, details);
        onChange(next.lines);
        setMessages(next.messages.length ? next.messages : [r.error.message]);
        if (!next.lines.length) setConfirming(false);
      } else setMessages([r.error.message]);
    } catch {
      setMessages(["Não deu para enviar. Confira a internet e toque em Confirmar de novo."]);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="grid gap-3" aria-label="Seu pedido">
      <h2 className="text-lg font-semibold">Seu pedido</h2>
      {sent && (
        <div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-emerald-900">
          <p className="font-semibold">Pedido enviado para a cozinha</p>
          <p className="text-sm">
            Pedido nº {sent.number} · {brl(sent.total)}
          </p>
        </div>
      )}
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada no pedido ainda.</p>
      ) : (
        <ul className="grid gap-2">
          {lines.map((l) => (
            <li key={l.key} className="grid gap-1 border-b border-border pb-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{l.name}</span>
                <span>{brl(lineTotal(l))}</span>
              </div>
              <LineChanges changes={lineChanges(l)} />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 min-w-11"
                  aria-label={`Menos um ${l.name}`}
                  onClick={() => onChange(setQuantity(lines, l.key, l.quantity - 1))}
                >
                  −
                </Button>
                <output aria-label={`Quantidade de ${l.name}`} className="w-6 text-center">
                  {l.quantity}
                </output>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 min-w-11"
                  aria-label={`Mais um ${l.name}`}
                  disabled={l.quantity >= MAX_LINE_QUANTITY}
                  onClick={() => onChange(setQuantity(lines, l.key, l.quantity + 1))}
                >
                  +
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="ml-auto h-11"
                  aria-label={`Tirar ${l.name} do pedido`}
                  onClick={() => onChange(setQuantity(lines, l.key, 0))}
                >
                  Tirar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="flex justify-between text-lg font-semibold">
        <span>Total</span>
        <span data-testid="cart-total">{brl(total)}</span>
      </p>
      {!confirming && messages.length > 0 && (
        <div role="alert" className="grid gap-1 rounded bg-amber-100 p-2 text-sm text-amber-900">
          {messages.map((m) => (
            <p key={m}>{m}</p>
          ))}
        </div>
      )}
      <Button type="button" className="h-12 text-base" disabled={lines.length === 0} onClick={open}>
        Enviar pedido
      </Button>

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confira o pedido"
          className="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center"
        >
          <div className="grid max-h-[90vh] w-full max-w-md gap-3 overflow-y-auto rounded-t-xl bg-background p-4 sm:rounded-xl">
            <h2 className="text-lg font-semibold">Confira o pedido</h2>
            <ul className="grid gap-2 text-sm">
              {lines.map((l) => (
                <li key={l.key}>
                  <div className="flex justify-between gap-2">
                    <span>
                      {l.quantity} × {l.name}
                    </span>
                    <span>{brl(lineTotal(l))}</span>
                  </div>
                  <LineChanges changes={lineChanges(l)} />
                </li>
              ))}
            </ul>
            <p className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{brl(total)}</span>
            </p>
            {messages.length > 0 && (
              <div role="alert" className="grid gap-1 rounded bg-amber-100 p-2 text-sm text-amber-900">
                {messages.map((m) => (
                  <p key={m}>{m}</p>
                ))}
              </div>
            )}
            <Button type="button" className="h-12 text-base" disabled={sending} onClick={confirm}>
              Confirmar
            </Button>
            <Button type="button" variant="ghost" className="h-11" disabled={sending} onClick={() => setConfirming(false)}>
              Voltar
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

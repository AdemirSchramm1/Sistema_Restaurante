"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ActionState } from "@/actions/_session";
import type { SubmitOrderResult } from "@/application/ordering/submit-order";
import { MAX_LINE_QUANTITY } from "@/domain/ordering/order-lines";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  applyPriceChanges,
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
import { brl } from "./format";
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
  /** `null` na pré-visualização da equipe (spec 013, US5): o carrinho aparece, mas não envia. */
  submit: SubmitFn | null;
  onSent?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  // A conferência é modal: a página atrás fica inerte (sem foco, sem toque, fora da leitura de tela).
  useEffect(() => {
    const page = document.querySelector("main");
    if (!confirming || !page) return;
    page.setAttribute("inert", "");
    return () => page.removeAttribute("inert");
  }, [confirming]);
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
      const r = await submit!({ clientRequestId: requestId.current, lines: toOrderLines(lines) });
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
    <section
      className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
      aria-label="Seu pedido"
    >
      <h2 className="font-display text-xl font-semibold">Seu pedido</h2>
      {sent && (
        <Alert tone="success">
          <p className="font-semibold">Pedido enviado para a cozinha</p>
          <p>
            Pedido nº {sent.number} · {brl(sent.total)}
          </p>
        </Alert>
      )}
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada no pedido ainda.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {lines.map((l) => (
            <li key={l.key} className="grid grid-cols-1 gap-1 border-b border-border pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
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
      <p className="flex flex-wrap justify-between gap-x-3 text-lg font-semibold">
        <span>Total</span>
        <span data-testid="cart-total">{brl(total)}</span>
      </p>
      {!confirming && messages.length > 0 && (
        <Alert tone="warning" role="alert">
          {messages.map((m) => (
            <p key={m}>{m}</p>
          ))}
        </Alert>
      )}
      {submit && (
        <Button
          type="button"
          size="xl"
          className="h-auto min-h-12 whitespace-normal py-2"
          disabled={lines.length === 0}
          onClick={open}
        >
          Enviar pedido
        </Button>
      )}

      {confirming &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confira o pedido"
            className="fixed inset-0 z-50 grid place-items-end bg-overlay sm:place-items-center"
          >
            <div className="grid max-h-[90vh] w-full grid-cols-1 max-w-md gap-3 overflow-y-auto rounded-t-xl bg-background p-4 sm:rounded-xl">
              <h2 className="text-lg font-semibold">Confira o pedido</h2>
              <ul className="grid grid-cols-1 gap-2 text-sm">
                {lines.map((l) => (
                  <li key={l.key}>
                    <div className="flex flex-wrap justify-between gap-x-2">
                      <span>
                        {l.quantity} × {l.name}
                      </span>
                      <span>{brl(lineTotal(l))}</span>
                    </div>
                    <LineChanges changes={lineChanges(l)} />
                  </li>
                ))}
              </ul>
              <p className="flex flex-wrap justify-between gap-x-3 font-semibold">
                <span>Total</span>
                <span>{brl(total)}</span>
              </p>
              {messages.length > 0 && (
                <Alert tone="warning" role="alert">
                  {messages.map((m) => (
                    <p key={m}>{m}</p>
                  ))}
                </Alert>
              )}
              <Button
                type="button"
                size="xl"
                className="h-auto min-h-12 whitespace-normal py-2"
                disabled={sending}
                onClick={confirm}
              >
                Confirmar
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11"
                disabled={sending}
                onClick={() => setConfirming(false)}
              >
                Voltar
              </Button>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}

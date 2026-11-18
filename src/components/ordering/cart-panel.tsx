"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Cart, type SubmitFn } from "./cart";
import { CartBar } from "./cart-bar";
import type { CartLine } from "./cart-state";

/**
 * Carrinho sempre à vista (spec 016, US3, R10). Um só carrinho, posto pela largura no CSS:
 *
 * - a partir de 1024 px, coluna de 320 px ao lado, presa no topo; só a lista rola e o total e
 *   **Enviar pedido** ficam no pé (SC-002);
 * - abaixo disso, escondido; a barra do pé abre o mesmo carrinho por cima do cardápio.
 */
export function CartPanel({
  lines,
  onChange,
  submit,
  onSent,
  highlight,
}: {
  lines: CartLine[];
  onChange: (lines: CartLine[]) => void;
  submit: SubmitFn | null;
  onSent?: () => void;
  highlight: string | null;
}) {
  const [over, setOver] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  // Carrinho esvaziado com ele aberto por cima: nada a mostrar, volta ao cardápio.
  const open = over && lines.length > 0;
  useEffect(() => {
    if (open) title.current?.focus();
  }, [open]);
  const show = () => setOver(true);
  return (
    <>
      <aside
        data-testid="cart-panel"
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? "Seu pedido" : undefined}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOver(false);
        }}
        className={cn(
          "lg:sticky lg:top-16 lg:z-0 lg:flex lg:max-h-[calc(100dvh-5rem)] lg:flex-col lg:self-start",
          open
            ? "fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col p-2 pb-[env(safe-area-inset-bottom)] shadow-lg lg:static lg:p-0 lg:shadow-none"
            : "hidden",
        )}
      >
        <Cart
          lines={lines}
          onChange={onChange}
          submit={submit}
          onSent={() => {
            setOver(false);
            onSent?.();
          }}
          highlight={highlight}
          onClose={() => setOver(false)}
          titleRef={title}
        />
      </aside>
      {open && (
        <div aria-hidden className="fixed inset-0 z-30 bg-overlay lg:hidden" onClick={() => setOver(false)} />
      )}
      {!open && <CartBar lines={lines} onOpen={show} />}
      {lines.length > 0 && (
        <div
          data-testid="cart-bar-space"
          aria-hidden
          className="h-[calc(5rem+env(safe-area-inset-bottom))] lg:hidden"
        />
      )}
    </>
  );
}

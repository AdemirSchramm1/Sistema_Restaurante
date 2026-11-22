"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * "Ainda está aí?" do tablet (spec 016, US5-2): o carrinho tem algo e ninguém toca há 3 minutos.
 * **Continuar** já vem em foco. A contagem aparece na tela, mas o leitor de tela ouve só o começo.
 */
export function StillThere({ secondsLeft, onContinue }: { secondsLeft: number; onContinue: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [announced] = useState(`O carrinho será limpo em ${secondsLeft} segundos.`);
  useEffect(() => box.current?.querySelector("button")?.focus(), []);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
      <div
        ref={box}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="still-there-title"
        aria-describedby="still-there-text"
        className="grid w-full max-w-sm gap-4 rounded-2xl bg-background p-6 text-center shadow-xl"
      >
        <h2 id="still-there-title" className="font-display text-2xl font-semibold">
          Ainda está aí?
        </h2>
        <p id="still-there-text">Seu pedido não foi enviado.</p>
        <p aria-hidden className="text-3xl font-semibold tabular-nums">
          {secondsLeft} s
        </p>
        <p role="status" className="sr-only">
          {announced}
        </p>
        <Button type="button" size="lg" className="h-14 text-lg" onClick={onContinue}>
          Continuar
        </Button>
      </div>
    </div>
  );
}

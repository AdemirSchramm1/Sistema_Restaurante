"use client";

import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WRAPPING_BUTTON } from "./feedback";

/** Os três tamanhos da pré-visualização: 1, 2 e 3 colunas de cartões (contracts/screens.md). */
const SIZES = [
  { name: "Celular", width: 390, height: 844 },
  { name: "Tablet em pé", width: 768, height: 1024 },
  { name: "Tablet deitado", width: 1024, height: 768 },
] as const;

/**
 * "Ver como o cliente" (spec 013, US5): o cardápio do cliente dentro de uma moldura do tamanho
 * escolhido. A moldura é uma página de verdade, então as colunas e a barra de seções se comportam
 * como no aparelho. Maior que a tela, ela rola dentro da própria caixa.
 */
export function PreviewFrame({ src }: { src: string }) {
  const [size, setSize] = useState<(typeof SIZES)[number]>(SIZES[0]);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* No celular não há o que escolher: a moldura ocupa a largura da tela. */}
        <div role="group" aria-label="Tamanho da tela" className="flex flex-wrap gap-2 max-sm:hidden">
          {SIZES.map((s) => (
            <Button
              key={s.name}
              type="button"
              size="lg"
              variant={s === size ? "default" : "outline"}
              aria-pressed={s === size}
              className={WRAPPING_BUTTON}
              onClick={() => setSize(s)}
            >
              {s.name}
            </Button>
          ))}
        </div>
        <a href={src} className={cn(buttonVariants({ variant: "ghost", size: "lg" }), WRAPPING_BUTTON)}>
          Abrir em tela cheia
        </a>
      </div>
      <div
        role="region"
        aria-label="Moldura da pré-visualização"
        tabIndex={0}
        className="overflow-x-auto rounded-xl border border-border bg-muted p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <iframe
          title="Cardápio como o cliente vê"
          src={src}
          style={{ width: `${size.width}px`, height: `${size.height}px` }}
          // `box-content`: a largura escolhida é a do conteúdo; a borda fica por fora.
          className="mx-auto box-content block max-w-none rounded-lg border border-border bg-background max-sm:!h-[75vh] max-sm:!w-full"
        />
      </div>
    </div>
  );
}

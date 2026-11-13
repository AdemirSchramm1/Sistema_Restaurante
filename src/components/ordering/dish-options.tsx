"use client";

import { useState } from "react";
import type { MenuProduct } from "@/application/ordering/menu";
import { MAX_LINE_QUANTITY } from "@/domain/ordering/order-lines";
import { Button } from "@/components/ui/button";
import { brl, priceOrFree } from "./format";
import { lineTotal, type CartLineData } from "./cart-state";

const big = "h-11 min-w-11 text-lg";

/**
 * Tela do prato: só botões, nenhum campo de texto (spec 010, US3; decisão "Só botões"). Mudança que
 * não está nos botões é com o garçom.
 */
export function DishOptions({
  product,
  onAdd,
  onClose,
}: {
  product: MenuProduct;
  onAdd: (line: CartLineData) => void;
  onClose: () => void;
}) {
  const [times, setTimes] = useState<Record<string, number>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [quantity, setQuantity] = useState(1);

  const line: CartLineData = {
    productId: product.id,
    name: product.name,
    basePrice: product.price,
    quantity,
    addons: product.addons
      .filter((a) => (times[a.id] ?? 0) > 0)
      .map((a) => ({ id: a.id, name: a.name, price: a.price, times: times[a.id]! })),
    removals: product.removables.filter((r) => removed.has(`${r.kind}:${r.id}`)),
  };
  const bump = (id: string, by: number, max: number) =>
    setTimes((t) => ({ ...t, [id]: Math.max(0, Math.min(max, (t[id] ?? 0) + by)) }));
  const toggle = (key: string) =>
    setRemoved((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  return (
    <section className="grid gap-4" aria-label={product.name}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-xl font-semibold">{product.name}</h2>
        <span className="text-lg">{brl(product.price)}</span>
      </div>

      {product.addons.length > 0 && (
        <div className="grid gap-2">
          <h3 className="font-medium">Adicionar</h3>
          <ul className="grid gap-2">
            {product.addons.map((a) => {
              const n = times[a.id] ?? 0;
              return (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <span>
                    {a.name} <span className="text-sm text-muted-foreground">{priceOrFree(a.price)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className={big}
                      aria-label={`Menos ${a.name}`}
                      disabled={n === 0}
                      onClick={() => bump(a.id, -1, a.maxTimes)}
                    >
                      −
                    </Button>
                    <output aria-label={`Quantidade de ${a.name}`} className="w-6 text-center text-lg">
                      {n}
                    </output>
                    <Button
                      type="button"
                      variant="outline"
                      className={big}
                      aria-label={`Mais ${a.name}`}
                      disabled={n >= a.maxTimes}
                      onClick={() => bump(a.id, 1, a.maxTimes)}
                    >
                      +
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {product.removables.length > 0 && (
        <div className="grid gap-2">
          <h3 className="font-medium">Tirar</h3>
          <div className="flex flex-wrap gap-2">
            {product.removables.map((r) => {
              const key = `${r.kind}:${r.id}`;
              const on = removed.has(key);
              return (
                <Button
                  key={key}
                  type="button"
                  variant={on ? "default" : "outline"}
                  className="h-11"
                  aria-pressed={on}
                  onClick={() => toggle(key)}
                >
                  {on ? "✓ " : ""}
                  {r.label}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground">Precisa de outra mudança? Chame um garçom.</p>

      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className={big}
            aria-label="Menos um prato"
            disabled={quantity <= 1}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            −
          </Button>
          <output aria-label="Quantidade" className="w-6 text-center text-lg">
            {quantity}
          </output>
          <Button
            type="button"
            variant="outline"
            className={big}
            aria-label="Mais um prato"
            disabled={quantity >= MAX_LINE_QUANTITY}
            onClick={() => setQuantity((q) => Math.min(MAX_LINE_QUANTITY, q + 1))}
          >
            +
          </Button>
        </span>
        <span data-testid="dish-total" className="text-lg font-semibold">
          {brl(lineTotal(line))}
        </span>
      </div>
      <div className="grid gap-2">
        <Button type="button" size="xl" onClick={() => onAdd(line)}>
          Adicionar ao pedido
        </Button>
        <Button type="button" variant="ghost" className="h-11" onClick={onClose}>
          Voltar ao cardápio
        </Button>
      </div>
    </section>
  );
}

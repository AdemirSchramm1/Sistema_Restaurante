"use client";

import { useState } from "react";
import type { AccessOrderView, MenuProduct, MenuView } from "@/application/ordering/menu";
import { normalizeDescription } from "@/domain/inventory/description";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AccessTimer } from "./access-timer";
import { AutoRefresh } from "./auto-refresh";
import { Cart, type SubmitFn } from "./cart";
import { addToCart, brl, type CartLine } from "./cart-state";
import { DishOptions } from "./dish-options";
import { MyOrders } from "./my-orders";

/**
 * Cardápio do celular, sem login (spec 009 US2/US3, spec 010 US3): lista com busca, tela do prato
 * com botões, carrinho, tempo do acesso e "Meus pedidos".
 */
export function MenuApp({
  menu,
  orders,
  submit,
}: {
  menu: MenuView;
  orders: AccessOrderView[];
  submit: SubmitFn;
}) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [open, setOpen] = useState<MenuProduct | null>(null);
  const [q, setQ] = useState("");
  const [expired, setExpired] = useState(false);

  const query = normalizeDescription(q);
  const shown = query
    ? menu.products.filter((p) => normalizeDescription(p.name).includes(query))
    : menu.products;
  const add = (p: MenuProduct) => {
    if (p.addons.length === 0 && p.removables.length === 0)
      setLines((c) =>
        addToCart(c, {
          productId: p.id,
          name: p.name,
          basePrice: p.price,
          quantity: 1,
          addons: [],
          removals: [],
        }),
      );
    else setOpen(p);
  };

  return (
    <div className="grid gap-5">
      <header className="grid gap-1">
        <span className="text-sm text-muted-foreground">{menu.restaurantName}</span>
        <h1 className="text-2xl font-semibold">Mesa {menu.tableName}</h1>
        <AccessTimer
          key={menu.serverNow}
          serverNow={menu.serverNow}
          expiresAt={menu.expiresAt}
          unsent={lines.map((l) => ({ name: l.name, quantity: l.quantity }))}
          onExpire={() => setExpired(true)}
        />
      </header>

      {!expired && <AutoRefresh seconds={10} />}

      {!expired &&
        (open ? (
          <DishOptions
            product={open}
            onClose={() => setOpen(null)}
            onAdd={(line) => {
              setLines((c) => addToCart(c, line));
              setOpen(null);
            }}
          />
        ) : (
          <>
            <Input
              type="search"
              aria-label="Buscar no cardápio"
              placeholder="Buscar no cardápio"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-11 text-base"
            />
            <ul className="grid gap-2" aria-label="Cardápio">
              {shown.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 border-b border-border py-2"
                >
                  <div className="grid">
                    <span className="text-base font-medium">{p.name}</span>
                    <span className="text-sm text-muted-foreground">{brl(p.price)}</span>
                  </div>
                  <Button
                    type="button"
                    className="h-11"
                    aria-label={`Adicionar ${p.name}`}
                    onClick={() => add(p)}
                  >
                    Adicionar
                  </Button>
                </li>
              ))}
              {shown.length === 0 && <li className="text-sm text-muted-foreground">Nada com esse nome.</li>}
            </ul>
            {menu.ordersLeft > 0 ? (
              <Cart lines={lines} onChange={setLines} submit={submit} />
            ) : (
              <p role="status" className="rounded bg-muted p-3 text-center">
                Chame um garçom para continuar pedindo.
              </p>
            )}
          </>
        ))}

      <MyOrders orders={orders} />
    </div>
  );
}

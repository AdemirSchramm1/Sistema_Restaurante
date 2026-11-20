"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { StaffTableView } from "@/application/ordering/staff-orders";
import { matchesSearch } from "@/domain/menu/search";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { brl } from "@/components/ordering/format";
import { itemCount } from "@/components/ordering/cart-state";
import { cartsOf, deviceStorage, forgetOtherUsers } from "./cart-storage";
import { useHydrated } from "./use-hydrated";
import { itemsText, sinceText } from "./format";

/**
 * Lançar pedido: a grade de mesas ativas (spec 015, US1-1, US5-4). Cada mesa diz se está livre ou
 * ocupada, quantos pedidos estão prontos e se tem carrinho não enviado neste aparelho.
 */
export function TableGrid({
  tables,
  qrOrdersOff,
  restaurantId,
  userId,
  serverNow,
}: {
  tables: StaffTableView[];
  qrOrdersOff: boolean;
  restaurantId: string;
  userId: string;
  serverNow: string;
}) {
  const [q, setQ] = useState("");
  const hydrated = useHydrated();
  // Lido no navegador: carrinhos de outro garçom neste aparelho somem antes de contar os meus.
  const carts = useMemo(() => {
    if (!hydrated) return new Map<string, number>();
    const storage = deviceStorage();
    forgetOtherUsers(storage, restaurantId, userId);
    const mine = cartsOf(storage, restaurantId, userId, Date.parse(serverNow));
    return new Map([...mine].map(([table, c]) => [table, itemCount(c.lines)]));
  }, [hydrated, restaurantId, userId, serverNow]);

  const shown = tables.filter((t) => matchesSearch(`Mesa ${t.name}`, q) || matchesSearch(t.name, q));
  return (
    <div className="grid grid-cols-1 gap-4">
      {qrOrdersOff && <Alert tone="info">O QR code está desligado: só a equipe lança pedidos.</Alert>}
      <Input
        type="search"
        size="lg"
        aria-label="Buscar mesa"
        placeholder="Buscar mesa"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" aria-label="Mesas">
        {shown.map((t) => {
          const inCart = carts.get(t.id) ?? 0;
          return (
            <li key={t.id}>
              <Link
                href={`/pedidos/lancar/${t.id}`}
                className={`grid min-h-24 content-start gap-1 rounded-xl border p-3 shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  t.tab
                    ? "border-primary bg-primary-soft text-primary-soft-foreground"
                    : "border-border bg-card"
                }`}
              >
                <span className="font-display text-xl font-semibold [overflow-wrap:anywhere]">
                  Mesa {t.name}
                </span>
                <span className="text-sm">
                  {t.tab
                    ? `Ocupada · ${brl(t.tab.total)} · ${sinceText(t.tab.openedAt, serverNow)}`
                    : "Livre"}
                </span>
                {t.readyCount > 0 && (
                  <span className="text-sm font-semibold">
                    {t.readyCount === 1 ? "1 pronto" : `${t.readyCount} prontos`}
                  </span>
                )}
                {inCart > 0 && <span className="text-sm font-semibold">Carrinho: {itemsText(inCart)}</span>}
              </Link>
            </li>
          );
        })}
        {shown.length === 0 && <li className="text-sm text-muted-foreground">Nenhuma mesa com esse nome.</li>}
      </ul>
    </div>
  );
}

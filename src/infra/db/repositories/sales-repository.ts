import { sql } from "drizzle-orm";
import type { PeriodSales, SalesRepo } from "@/application/cash/ports";
import { d } from "@/domain/shared/decimal";
import type { Tx } from "../db";

type SalesRow = { kind: "PRODUCT" | "ADDON"; id: string; name: string; quantity: number; amount: string };

/**
 * Vendas do período pelo dia do pedido (spec 014, US6). O preço da linha já tem os adicionais;
 * o adicional conta `vezes × quantidade da linha`. Pedido cancelado não conta. Os adicionais vêm do
 * que mais vendeu para o que menos vendeu (os produtos são ordenados por `salesShares`).
 */
export function salesRepository(tx: Tx, restaurantId: string): SalesRepo {
  return {
    async ofPeriod(fromDay, toDay): Promise<PeriodSales> {
      const lines = await tx.execute(sql`
        with sold as (
          select l.id, l.recipe_id, l.quantity, l.unit_price
            from orders o
            join order_lines l on l.order_id = o.id
           where o.restaurant_id = ${restaurantId}
             and o.business_day between ${fromDay}::date and ${toDay}::date
             and o.status <> 'CANCELLED'
        )
        select 'PRODUCT' as kind, s.recipe_id as id, r.name,
               sum(s.quantity)::int as quantity, sum(s.quantity * s.unit_price) as amount
          from sold s
          join recipes r on r.id = s.recipe_id
         group by s.recipe_id, r.name
        union all
        select 'ADDON', a.addon_id, a.name,
               sum(a.times * s.quantity)::int, sum(a.times * s.quantity * a.unit_price)
          from sold s
          join order_line_addons a on a.order_line_id = s.id
         group by a.addon_id, a.name
         -- numeric (o pg devolve em texto, sem perder casas): ordena pelo valor, não pela letra
         order by kind desc, amount desc, name`);
      const totals = await tx.execute(sql`
        select
          (select coalesce(sum(service_charge), 0)::text
             from table_tabs
            where restaurant_id = ${restaurantId}
              and status = 'CLOSED'
              and closed_day between ${fromDay}::date and ${toDay}::date) as service_charge,
          (select count(*)::int
             from orders
            where restaurant_id = ${restaurantId}
              and business_day between ${fromDay}::date and ${toDay}::date
              and status in ('RECEIVED', 'PREPARING', 'READY')) as pending_orders`);
      const rows = lines.rows as SalesRow[];
      const t = totals.rows[0] as { service_charge: string; pending_orders: number };
      return {
        products: rows
          .filter((r) => r.kind === "PRODUCT")
          .map((r) => ({ recipeId: r.id, name: r.name, quantity: r.quantity, amount: d(r.amount) })),
        addons: rows
          .filter((r) => r.kind === "ADDON")
          .map((r) => ({ addonId: r.id, name: r.name, times: r.quantity, amount: d(r.amount) })),
        serviceCharge: d(t.service_charge),
        pendingOrders: t.pending_orders,
      };
    },
  };
}

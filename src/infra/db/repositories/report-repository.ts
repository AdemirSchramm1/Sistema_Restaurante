import { sql, type SQL } from "drizzle-orm";
import type { OutflowByItem, ReorderRow, ReportRepo } from "@/application/inventory/ports";
import type { MovementType } from "@/domain/inventory/movement";
import { d } from "@/domain/shared/decimal";
import type { Tx } from "../db";
import { dec, UNIT_CODE_BY_ID } from "./util";

/**
 * Consultas só de leitura do aviso de reposição e dos gráficos (spec 006). O RLS limita ao
 * restaurante da transação; o filtro por `restaurant_id` ajuda o índice.
 *
 * Saída (FR-004): quantidade negativa, não é estorno e não foi estornada.
 */
const OUTFLOW = (m: string) =>
  sql.raw(
    `${m}.quantity < 0 and ${m}.type <> 'REVERSAL' and not exists (select 1 from stock_movements r where r.reverses_id = ${m}.id)`,
  );
/** Entrada: compra não estornada. */
const INFLOW = (m: string) =>
  sql.raw(
    `${m}.type = 'PURCHASE' and not exists (select 1 from stock_movements r where r.reverses_id = ${m}.id)`,
  );

async function rows<T>(tx: Tx, q: SQL): Promise<T[]> {
  const r = await tx.execute(q);
  return r.rows as T[];
}

export function reportRepository(tx: Tx, restaurantId: string): ReportRepo {
  const inPeriod = (from: Date, to: Date) =>
    sql`m.restaurant_id = ${restaurantId} and m.occurred_at >= ${from.toISOString()} and m.occurred_at <= ${to.toISOString()}`;

  return {
    async reorderRows(f) {
      // Um item só vem mesmo sem aviso (quadro do item); a lista traz só quem tem aviso.
      const where: SQL[] = f.itemId ? [sql`i.id = ${f.itemId}`] : [sql`i.reorder_point is not null`];
      if (f.atPointOnly) where.push(sql`i.active and coalesce(b.quantity, 0) <= i.reorder_point`);
      const r = await rows<{
        id: string;
        code: string;
        description: string;
        stock_unit_id: string;
        active: boolean;
        balance: string | null;
        reorder_point: string | null;
        par_level: string | null;
        purchase_unit_label: string | null;
        purchase_factor: string | null;
        s_name: string | null;
        s_phone: string | null;
        s_lead: number | null;
        s_days: number[] | null;
        s_label: string | null;
        s_qty: string | null;
      }>(
        tx,
        sql`select i.id, i.code, i.description, i.stock_unit_id, i.active, b.quantity as balance,
                   i.reorder_point, i.par_level, i.purchase_unit_label, i.purchase_factor,
                   s.name as s_name, s.phone as s_phone, s.lead_time_days as s_lead, s.delivery_days as s_days,
                   si.package_label as s_label, si.package_quantity as s_qty
              from items i
              left join stock_balances b on b.item_id = i.id
              left join supplier_items si on si.item_id = i.id and si.preferred
              left join suppliers s on s.id = si.supplier_id
             where i.restaurant_id = ${restaurantId} and ${sql.join(where, sql` and `)}
             order by i.description`,
      );
      return r.map((x): ReorderRow => ({
        itemId: x.id,
        code: x.code,
        name: x.description,
        unit: UNIT_CODE_BY_ID[x.stock_unit_id]!,
        active: x.active,
        balance: d(x.balance ?? "0"),
        reorderPoint: dec(x.reorder_point),
        parLevel: dec(x.par_level),
        purchaseUnitLabel: x.purchase_unit_label,
        purchaseFactor: dec(x.purchase_factor),
        supplier: x.s_name
          ? {
              name: x.s_name,
              phone: x.s_phone,
              leadTimeDays: x.s_lead,
              deliveryDays: x.s_days!,
              packageLabel: x.s_label,
              packageQuantity: dec(x.s_qty),
            }
          : null,
      }));
    },

    async countAtReorderPoint() {
      const [r] = await rows<{ n: number }>(
        tx,
        sql`select count(*)::int as n
              from items i left join stock_balances b on b.item_id = i.id
             where i.restaurant_id = ${restaurantId} and i.active and i.reorder_point is not null
               and coalesce(b.quantity, 0) <= i.reorder_point`,
      );
      return r!.n;
    },

    async outflowByItem(from, to, itemIds) {
      const only = itemIds
        ? sql`and i.id in (${sql.join(
            itemIds.map((id) => sql`${id}`),
            sql`, `,
          )})`
        : sql``;
      const r = await rows<{
        id: string;
        description: string;
        stock_unit_id: string;
        qty: string;
        value: string;
        balance: string;
      }>(
        tx,
        sql`with o as (
              select m.item_id, -sum(m.quantity) as qty, -sum(m.total_cost) as value
                from stock_movements m
               where ${inPeriod(from, to)} and ${OUTFLOW("m")}
               group by m.item_id
            )
            select i.id, i.description, i.stock_unit_id,
                   coalesce(o.qty, 0) as qty, coalesce(o.value, 0) as value, coalesce(b.quantity, 0) as balance
              from items i
              left join o on o.item_id = i.id
              left join stock_balances b on b.item_id = i.id
             where i.restaurant_id = ${restaurantId} and i.active
               and (o.item_id is not null or coalesce(b.quantity, 0) > 0) ${only}`,
      );
      return r.map((x): OutflowByItem => ({
        itemId: x.id,
        name: x.description,
        unit: UNIT_CODE_BY_ID[x.stock_unit_id]!,
        quantity: d(x.qty),
        value: d(x.value),
        balance: d(x.balance),
      }));
    },

    async outflowByReason(from, to) {
      const r = await rows<{ type: MovementType; reason_id: string | null; value: string }>(
        tx,
        sql`select m.type, m.reason_id, -sum(m.total_cost) as value
              from stock_movements m
             where ${inPeriod(from, to)} and ${OUTFLOW("m")}
             group by m.type, m.reason_id
             order by value desc`,
      );
      return r.map((x) => ({ type: x.type, reasonId: x.reason_id, value: d(x.value) }));
    },

    async totals(from, to) {
      const [r] = await rows<{ inflow: string; outflow: string; losses: string }>(
        tx,
        sql`select coalesce(sum(m.total_cost) filter (where ${INFLOW("m")}), 0) as inflow,
                   coalesce(-sum(m.total_cost) filter (where ${OUTFLOW("m")}), 0) as outflow,
                   coalesce(-sum(m.total_cost) filter (where m.type = 'LOSS' and ${OUTFLOW("m")}), 0) as losses
              from stock_movements m
             where ${inPeriod(from, to)}`,
      );
      // Soma com coalesce: a linha sempre vem.
      return { inflow: d(r!.inflow), outflow: d(r!.outflow), losses: d(r!.losses) };
    },

    async weekly(from, to, timezone) {
      const r = await rows<{ week: string; inflow: string; outflow: string }>(
        tx,
        sql`with w as (
              select generate_series(
                       date_trunc('week', ${from.toISOString()}::timestamptz at time zone ${timezone}),
                       date_trunc('week', ${to.toISOString()}::timestamptz at time zone ${timezone}),
                       interval '1 week') as week
            ),
            m as (
              select date_trunc('week', m.occurred_at at time zone ${timezone}) as week,
                     case when ${INFLOW("m")} then m.total_cost else 0 end as inflow,
                     case when ${OUTFLOW("m")} then -m.total_cost else 0 end as outflow
                from stock_movements m
               where ${inPeriod(from, to)}
            )
            select to_char(w.week, 'YYYY-MM-DD') as week,
                   coalesce(sum(m.inflow), 0) as inflow, coalesce(sum(m.outflow), 0) as outflow
              from w left join m on m.week = w.week
             group by w.week
             order by w.week`,
      );
      return r.map((x) => ({ weekStart: x.week, inflow: d(x.inflow), outflow: d(x.outflow) }));
    },
  };
}

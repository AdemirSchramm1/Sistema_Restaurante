import { and, eq, sql } from "drizzle-orm";
import type { ExceptionReviewRepo } from "@/application/ports";
import type { Tx } from "../db";
import { exceptionReviews, restaurants, users } from "../schema";
import { d } from "@/domain/shared/decimal";
import { UNIT_CODE_BY_ID } from "./util";

/** Revisão semanal das exceções da operação pequena (spec 019, US3 e R8). */
export function exceptionReviewRepository(tx: Tx, restaurantId: string): ExceptionReviewRepo {
  const timezone = sql`(select ${restaurants.timezone} from ${restaurants} where ${restaurants.id} = ${restaurantId})`;
  /** Segunda da semana local da decisão (a semana do Postgres começa na segunda). */
  const week = sql`(date_trunc('week', ar.decided_at at time zone ${timezone}))::date`;
  const localMidnight = (day: string) => sql`(${day}::date)::timestamp at time zone ${timezone}`;
  const exceptions = sql`ar.restaurant_id = ${restaurantId} and ar.self_decided and ar.status = 'APPROVED'`;

  return {
    async pendingWeeks(beforeWeek) {
      const r = await tx.execute(sql`
        select distinct ${week}::text as week
          from adjustment_requests ar
         where ${exceptions}
           and ar.decided_at < ${localMidnight(beforeWeek)}
           and not exists (select 1 from exception_reviews er
                            where er.restaurant_id = ${restaurantId} and er.week_start = ${week})
         order by 1`);
      return (r.rows as { week: string }[]).map((x) => x.week);
    },

    async weekExceptions(weekStart) {
      const r = await tx.execute(sql`
        select ar.id, ar.decided_at, u.name as decided_by_name, i.id as item_id, i.description,
               i.stock_unit_id, ar.difference, m.total_cost, ar.reason_id, ar.notes, b.quantity as balance
          from adjustment_requests ar
          join items i on i.id = ar.item_id
          join stock_movements m on m.id = ar.movement_id
          join stock_balances b on b.item_id = ar.item_id
          join users u on u.id = ar.decided_by
         where ${exceptions}
           and ar.decided_at >= ${localMidnight(weekStart)}
           and ar.decided_at < ${localMidnight(weekStart)} + interval '7 days'
         order by ar.decided_at, ar.id`);
      return (
        r.rows as {
          id: string;
          decided_at: string | Date;
          decided_by_name: string;
          item_id: string;
          description: string;
          stock_unit_id: string;
          difference: string;
          total_cost: string;
          reason_id: string;
          notes: string | null;
          balance: string;
        }[]
      ).map((x) => ({
        requestId: x.id,
        decidedAt: new Date(x.decided_at),
        decidedByName: x.decided_by_name,
        itemId: x.item_id,
        itemName: x.description,
        stockUnit: UNIT_CODE_BY_ID[x.stock_unit_id]!,
        difference: d(x.difference),
        value: d(x.total_cost),
        reasonId: x.reason_id,
        notes: x.notes,
        balance: d(x.balance),
      }));
    },

    async review(weekStart) {
      const [row] = await tx
        .select({ at: exceptionReviews.createdAt, note: exceptionReviews.note, name: users.name })
        .from(exceptionReviews)
        .leftJoin(users, eq(users.id, exceptionReviews.createdBy))
        .where(
          and(eq(exceptionReviews.restaurantId, restaurantId), eq(exceptionReviews.weekStart, weekStart)),
        );
      return row ? { reviewedByName: row.name, reviewedAt: row.at, note: row.note } : null;
    },

    async insert(r, audit) {
      const saved = await tx
        .insert(exceptionReviews)
        .values({
          id: r.id,
          restaurantId,
          weekStart: r.weekStart,
          note: r.note,
          createdAt: audit.at,
          createdBy: audit.by,
        })
        .onConflictDoNothing()
        .returning({ id: exceptionReviews.id });
      return saved.length > 0;
    },
  };
}

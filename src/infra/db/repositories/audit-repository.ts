import { and, asc, desc, eq, gte, inArray, lt, sql, type SQL } from "drizzle-orm";
import type { AuditRepo, AuditSearch, IdGenerator, Clock } from "@/application/ports";
import type { Origin } from "@/application/context";
import type { Tx } from "../db";
import { auditLog, restaurants, users } from "../schema";

export function auditRepository(tx: Tx, restaurantId: string, ids: IdGenerator, clock: Clock): AuditRepo {
  const timezone = sql`(select ${restaurants.timezone} from ${restaurants} where ${restaurants.id} = ${restaurantId})`;
  /** Meia-noite do dia local, no fuso do restaurante. */
  const localMidnight = (day: SQL) => sql`(${day})::timestamp at time zone ${timezone}`;
  const matching = (f: AuditSearch) =>
    and(
      eq(auditLog.restaurantId, restaurantId),
      gte(auditLog.occurredAt, localMidnight(sql`${f.fromDay}::date`)),
      lt(auditLog.occurredAt, localMidnight(sql`${f.toDay}::date + 1`)),
      f.userId ? eq(auditLog.userId, f.userId) : undefined,
      f.entities ? inArray(auditLog.entity, [...f.entities]) : undefined,
      f.deniedOnly ? eq(auditLog.action, "DENIED") : undefined,
    );

  return {
    async record(entry) {
      await tx.insert(auditLog).values({
        id: ids.next(),
        restaurantId,
        entity: entry.entity,
        entityId: entry.entityId,
        action: entry.action,
        changes: entry.changes,
        userId: entry.userId,
        occurredAt: clock.now(),
        origin: entry.origin,
      });
    },
    async history(entity, entityId) {
      const rows = await tx
        .select({ log: auditLog, userName: users.name })
        .from(auditLog)
        .leftJoin(users, eq(users.id, auditLog.userId))
        .where(and(eq(auditLog.entity, entity), eq(auditLog.entityId, entityId)))
        .orderBy(asc(auditLog.occurredAt), asc(auditLog.id));
      return rows.map(({ log, userName }) => ({
        entity: log.entity,
        entityId: log.entityId,
        action: log.action,
        changes: log.changes as Record<string, unknown>,
        userId: log.userId,
        origin: log.origin as Origin,
        occurredAt: log.occurredAt,
        userName,
      }));
    },
    async search(f) {
      const [count] = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(auditLog)
        .where(matching(f));
      const rows = await tx
        .select({ log: auditLog, userName: users.name })
        .from(auditLog)
        .leftJoin(users, eq(users.id, auditLog.userId))
        .where(matching(f))
        .orderBy(desc(auditLog.occurredAt), desc(auditLog.id))
        .limit(f.limit)
        .offset(f.offset);
      return {
        total: count!.total,
        rows: rows.map(({ log, userName }) => ({
          id: log.id,
          entity: log.entity,
          entityId: log.entityId,
          action: log.action,
          changes: log.changes as Record<string, unknown>,
          userId: log.userId,
          origin: log.origin as Origin,
          occurredAt: log.occurredAt,
          userName,
        })),
      };
    },
  };
}

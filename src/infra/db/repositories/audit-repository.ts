import { and, asc, eq } from "drizzle-orm";
import type { AuditRepo, IdGenerator, Clock } from "@/application/ports";
import type { Origin } from "@/application/context";
import type { Tx } from "../db";
import { auditLog, users } from "../schema";

export function auditRepository(tx: Tx, restaurantId: string, ids: IdGenerator, clock: Clock): AuditRepo {
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
  };
}

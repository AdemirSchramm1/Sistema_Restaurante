import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  CashCountRecord,
  CashEntryRecord,
  CashSessionRecord,
  CashSessionRepo,
  SessionPayments,
} from "@/application/cash/ports";
import type { Denominations } from "@/domain/cash/count";
import type { PaymentMethod } from "@/domain/billing/payment";
import { d } from "@/domain/shared/decimal";
import { err, ok } from "@/domain/shared/result";
import type { Tx } from "../db";
import { cashCounts, cashEntries, cashEntryRemovals, cashSessions, users } from "../schema";
import { dec, isUniqueViolation, withSavepoint } from "./util";

const opener = alias(users, "opener");
const closer = alias(users, "closer");
const author = alias(users, "author");
const remover = alias(users, "remover");

type PaymentBucket = "PAID" | "OWN" | "OTHER";
const BUCKETS: Record<PaymentBucket, keyof Omit<SessionPayments, "sessionId">> = {
  PAID: "paid",
  OWN: "removedInSession",
  OTHER: "removedFromOtherSessions",
};

/** Turno do caixa, sangria e reforço, contagens e as somas dos pagamentos do turno (spec 014). */
export function cashSessionRepository(tx: Tx, restaurantId: string): CashSessionRepo {
  const sessionSelect = () =>
    tx
      .select({ s: cashSessions, openedByName: opener.name, closedByName: closer.name })
      .from(cashSessions)
      .leftJoin(opener, eq(opener.id, cashSessions.openedBy))
      .leftJoin(closer, eq(closer.id, cashSessions.closedBy));
  type SessionRow = Awaited<ReturnType<ReturnType<typeof sessionSelect>["execute"]>>[number];
  const toSession = ({ s, openedByName, closedByName }: SessionRow): CashSessionRecord => ({
    id: s.id,
    status: s.status,
    businessDay: s.businessDay,
    openedAt: s.openedAt,
    openedBy: s.openedBy,
    openedByName,
    openingFloat: d(s.openingFloat),
    previousKept: dec(s.previousKept),
    openingNote: s.openingNote,
    clientRequestId: s.clientRequestId,
    closing:
      s.status === "CLOSED"
        ? {
            at: s.closedAt!,
            by: s.closedBy!,
            byName: closedByName,
            expected: d(s.expected!),
            counted: d(s.counted!),
            difference: d(s.difference!),
            kept: d(s.kept!),
            serviceCharge: d(s.serviceCharge!),
            countId: s.closingCountId!,
            note: s.closeNote,
          }
        : null,
    version: s.version,
  });
  const isOpen = and(eq(cashSessions.restaurantId, restaurantId), eq(cashSessions.status, "OPEN"));
  const one = async (where: ReturnType<typeof and>) => {
    const [r] = await sessionSelect().where(where);
    return r ? toSession(r) : null;
  };
  /** Trava a linha e só depois lê: a leitura já vê o que a transação da frente gravou. */
  const locked = async (where: ReturnType<typeof and>) => {
    const [row] = await tx.select({ id: cashSessions.id }).from(cashSessions).where(where).for("update");
    return row ? one(eq(cashSessions.id, row.id)) : null;
  };

  const entrySelect = () =>
    tx
      .select({
        e: cashEntries,
        byName: author.name,
        removedAt: cashEntryRemovals.createdAt,
        removedByName: remover.name,
      })
      .from(cashEntries)
      .leftJoin(author, eq(author.id, cashEntries.createdBy))
      .leftJoin(cashEntryRemovals, eq(cashEntryRemovals.entryId, cashEntries.id))
      .leftJoin(remover, eq(remover.id, cashEntryRemovals.createdBy));
  type EntryRow = Awaited<ReturnType<ReturnType<typeof entrySelect>["execute"]>>[number];
  const toEntry = ({ e, byName, removedAt, removedByName }: EntryRow): CashEntryRecord => ({
    id: e.id,
    sessionId: e.cashSessionId,
    kind: e.kind,
    amount: d(e.amount),
    reason: e.reason,
    note: e.note,
    at: e.createdAt,
    byName,
    removedAt,
    removedByName,
  });
  const oneEntry = async (where: ReturnType<typeof and>) => {
    const [r] = await entrySelect().where(where);
    return r ? toEntry(r) : null;
  };

  const countSelect = () =>
    tx
      .select({ c: cashCounts, byName: author.name })
      .from(cashCounts)
      .leftJoin(author, eq(author.id, cashCounts.createdBy));
  type CountRow = Awaited<ReturnType<ReturnType<typeof countSelect>["execute"]>>[number];
  const toCount = ({ c, byName }: CountRow): CashCountRecord => ({
    id: c.id,
    counted: d(c.counted),
    denominations: c.denominations as Denominations | null,
    sessionVersion: c.sessionVersion,
    at: c.createdAt,
    byName,
  });

  return {
    async open(s, audit) {
      try {
        await withSavepoint(tx, () =>
          tx.insert(cashSessions).values({
            id: s.id,
            restaurantId,
            createdAt: audit.at,
            createdBy: audit.by,
            updatedAt: audit.at,
            updatedBy: audit.by,
            status: "OPEN",
            businessDay: s.businessDay,
            openedAt: audit.at,
            openedBy: audit.by!,
            openingFloat: s.openingFloat.toFixed(2),
            previousKept: s.previousKept?.toFixed(2) ?? null,
            openingNote: s.note,
            clientRequestId: s.clientRequestId,
          }),
        );
        return ok(undefined);
      } catch (e) {
        if (isUniqueViolation(e, "cash_sessions_one_open")) return err("CASH_SESSION_ALREADY_OPEN");
        throw e;
      }
    },

    current: () => one(isOpen),
    lockOpen: () => locked(isOpen),
    get: (id) => one(eq(cashSessions.id, id)),
    lock: (id) => locked(eq(cashSessions.id, id)),

    async lastClosed() {
      const [r] = await sessionSelect()
        .where(and(eq(cashSessions.restaurantId, restaurantId), eq(cashSessions.status, "CLOSED")))
        .orderBy(desc(cashSessions.businessDay), desc(cashSessions.closedAt))
        .limit(1);
      return r ? toSession(r) : null;
    },

    async bumpVersion(id, audit) {
      await tx
        .update(cashSessions)
        .set({ version: sql`${cashSessions.version} + 1`, updatedAt: audit.at, updatedBy: audit.by })
        .where(eq(cashSessions.id, id));
    },

    async close(id, s, audit) {
      await tx
        .update(cashSessions)
        .set({
          status: "CLOSED",
          closedAt: audit.at,
          closedBy: audit.by,
          expected: s.expected.toFixed(2),
          counted: s.counted.toFixed(2),
          difference: s.difference.toFixed(2),
          kept: s.kept.toFixed(2),
          serviceCharge: s.serviceCharge.toFixed(2),
          closingCountId: s.countId,
          closeNote: s.note,
          version: sql`${cashSessions.version} + 1`,
          updatedAt: audit.at,
          updatedBy: audit.by,
        })
        .where(eq(cashSessions.id, id));
    },

    async list(fromDay, toDay) {
      const rows = await sessionSelect()
        .where(
          and(
            eq(cashSessions.restaurantId, restaurantId),
            gte(cashSessions.businessDay, fromDay),
            lte(cashSessions.businessDay, toDay),
          ),
        )
        .orderBy(desc(cashSessions.businessDay), desc(cashSessions.openedAt), desc(cashSessions.id));
      return rows.map(toSession);
    },

    async insertEntry(e, audit) {
      await tx.insert(cashEntries).values({
        id: e.id,
        restaurantId,
        createdAt: audit.at,
        createdBy: audit.by,
        cashSessionId: e.sessionId,
        kind: e.kind,
        amount: e.amount.toFixed(2),
        reason: e.reason,
        note: e.note,
        clientRequestId: e.clientRequestId,
      });
    },

    async entries(sessionId) {
      const rows = await entrySelect()
        .where(eq(cashEntries.cashSessionId, sessionId))
        .orderBy(asc(cashEntries.createdAt), asc(cashEntries.id));
      return rows.map(toEntry);
    },

    getEntry: (id) => oneEntry(eq(cashEntries.id, id)),
    entryByClientRequest: (sessionId, clientRequestId) =>
      oneEntry(
        and(eq(cashEntries.cashSessionId, sessionId), eq(cashEntries.clientRequestId, clientRequestId)),
      ),

    async removeEntry(entryId, id, audit) {
      try {
        await withSavepoint(tx, () =>
          tx
            .insert(cashEntryRemovals)
            .values({ id, restaurantId, createdAt: audit.at, createdBy: audit.by, entryId }),
        );
        return ok(undefined);
      } catch (e) {
        if (isUniqueViolation(e, "cash_entry_removals_entry")) return err("ALREADY_REMOVED");
        throw e;
      }
    },

    async entryAmounts(sessionIds) {
      if (!sessionIds.length) return [];
      const rows = await tx
        .select({
          sessionId: cashEntries.cashSessionId,
          kind: cashEntries.kind,
          amount: cashEntries.amount,
          removedId: cashEntryRemovals.id,
        })
        .from(cashEntries)
        .leftJoin(cashEntryRemovals, eq(cashEntryRemovals.entryId, cashEntries.id))
        .where(inArray(cashEntries.cashSessionId, sessionIds))
        .orderBy(asc(cashEntries.createdAt), asc(cashEntries.id));
      return rows.map((r) => ({
        sessionId: r.sessionId,
        kind: r.kind,
        amount: d(r.amount),
        removed: r.removedId !== null,
      }));
    },

    async insertCount(c, audit) {
      await tx.insert(cashCounts).values({
        id: c.id,
        restaurantId,
        createdAt: audit.at,
        createdBy: audit.by,
        cashSessionId: c.sessionId,
        counted: c.counted.toFixed(2),
        denominations: c.denominations,
        sessionVersion: c.sessionVersion,
      });
    },

    async counts(sessionId) {
      const rows = await countSelect()
        .where(eq(cashCounts.cashSessionId, sessionId))
        .orderBy(asc(cashCounts.createdAt), asc(cashCounts.id));
      return rows.map(toCount);
    },

    async lastCount(sessionId) {
      const [r] = await countSelect()
        .where(eq(cashCounts.cashSessionId, sessionId))
        .orderBy(desc(cashCounts.createdAt), desc(cashCounts.id))
        .limit(1);
      return r ? toCount(r) : null;
    },

    async payments(sessionIds) {
      const sums = new Map<string, SessionPayments>(
        sessionIds.map((sessionId) => [
          sessionId,
          { sessionId, paid: [], removedInSession: [], removedFromOtherSessions: [] },
        ]),
      );
      if (!sessionIds.length) return [];
      const ids = sql.join(
        sessionIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      );
      // Uma ida ao banco para as três somas: lançados no turno, tirados no próprio turno e tirados
      // de outro turno (pagamento de outro turno ou de antes da 014, sem turno).
      const r = await tx.execute(sql`
        select p.cash_session_id as session_id, 'PAID' as bucket, p.method, sum(p.amount) as amount
          from tab_payments p
         where p.cash_session_id in (${ids})
         group by p.cash_session_id, p.method
        union all
        select r.cash_session_id,
               case when p.cash_session_id = r.cash_session_id then 'OWN' else 'OTHER' end,
               p.method, sum(p.amount)
          from tab_payment_removals r
          join tab_payments p on p.id = r.payment_id
         where r.cash_session_id in (${ids})
         group by 1, 2, 3
         order by 1, 2, 3`);
      for (const row of r.rows as {
        session_id: string;
        bucket: PaymentBucket;
        method: PaymentMethod;
        amount: string;
      }[])
        sums.get(row.session_id)![BUCKETS[row.bucket]].push({ method: row.method, amount: d(row.amount) });
      return [...sums.values()];
    },

    async serviceCharge(sessionId) {
      const r = await tx.execute(sql`
        select coalesce(sum(service_charge), 0) as amount
          from table_tabs where cash_session_id = ${sessionId} and status = 'CLOSED'`);
      return d((r.rows[0] as { amount: string }).amount);
    },
  };
}

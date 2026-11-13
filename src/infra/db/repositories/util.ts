import { sql } from "drizzle-orm";
import { d, type Decimal } from "@/domain/shared/decimal";
import type { UnitCode } from "@/domain/inventory/units";
import type { Tx } from "../db";

export const dec = (v: string | null | undefined): Decimal | null => (v == null ? null : d(v));
export const str = (v: Decimal | null | undefined): string | null => (v == null ? null : v.toString());

/** IDs fixos do seed de `units` (migração 0001). */
export const UNIT_IDS: Record<UnitCode, string> = {
  g: "0193a000-0000-7000-8000-000000000001",
  kg: "0193a000-0000-7000-8000-000000000002",
  ml: "0193a000-0000-7000-8000-000000000003",
  l: "0193a000-0000-7000-8000-000000000004",
  un: "0193a000-0000-7000-8000-000000000005",
};
export const UNIT_CODE_BY_ID = Object.fromEntries(Object.entries(UNIT_IDS).map(([k, v]) => [v, k])) as Record<
  string,
  UnitCode
>;

type PgError = { code?: string; constraint?: string; message?: string; cause?: unknown };

function pgError(e: unknown): PgError | undefined {
  let cur: unknown = e;
  for (let i = 0; i < 4 && cur; i++) {
    const c = cur as PgError;
    if (typeof c.code === "string" && c.code.length === 5) return c;
    cur = c.cause;
  }
  return undefined;
}

export function isUniqueViolation(e: unknown, constraint?: string): boolean {
  const p = pgError(e);
  return p?.code === "23505" && (!constraint || p.constraint === constraint);
}

let savepointSeq = 0;
/** Roda `fn` dentro de um SAVEPOINT: se falhar (ex.: violação de unicidade), a transação continua utilizável. */
export async function withSavepoint<T>(tx: Tx, fn: () => Promise<T>): Promise<T> {
  const name = sql.raw(`sp_${++savepointSeq}`);
  await tx.execute(sql`savepoint ${name}`);
  try {
    const r = await fn();
    await tx.execute(sql`release savepoint ${name}`);
    return r;
  } catch (e) {
    await tx.execute(sql`rollback to savepoint ${name}`);
    throw e;
  }
}

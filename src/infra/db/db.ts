import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "./schema";

export type Schema = typeof schema;
export type Db = NodePgDatabase<Schema> & { $client: Pool };
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export function createDb(url: string, max = 10): Db {
  const pool = new Pool({ connectionString: url, max });
  return drizzle(pool, { schema });
}

/** Transação com o restaurante definido para o RLS (ADR 0004). Vale só dentro da transação. */
export async function withTenantTx<T>(db: Db, restaurantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.restaurant_id', ${restaurantId}, true)`);
    return fn(tx);
  });
}

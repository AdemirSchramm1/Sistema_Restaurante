import { inject } from "vitest";
import { Pool, type PoolClient } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../../src/infra/db/schema";
import type { Db } from "../../../src/infra/db/db";
import { makeDeps } from "../../../src/infra/deps";
import type { TestEnv } from "../harness";

/**
 * Dependências que contam cada ida ao banco (consulta, `begin`, `commit`), com o papel da
 * aplicação. Para testes que protegem o número de consultas de um caso de uso (spec 012, R6).
 */
export function countingEnv(env: TestEnv) {
  const pool = new Pool({ connectionString: inject("appUrl"), max: 2 });
  let statements = 0;
  pool.on("connect", (client: PoolClient) => {
    const query = client.query.bind(client) as (...args: unknown[]) => unknown;
    (client as unknown as { query: (...args: unknown[]) => unknown }).query = (...args: unknown[]) => {
      statements++;
      return query(...args);
    };
  });
  const db = drizzle(pool, { schema }) as unknown as Db;
  const deps = makeDeps({
    db,
    mailer: env.mailer,
    clock: env.clock,
    appUrl: "http://localhost:3000",
    authSecret: "segredo-de-teste-com-mais-de-32-caracteres",
    photos: env.deps.photos,
  });
  return {
    deps,
    /** Consultas desde a última leitura. */
    take() {
      const n = statements;
      statements = 0;
      return n;
    },
    close: () => pool.end(),
  };
}

import { inject } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../../src/infra/db/schema";
import type { Db } from "../../../src/infra/db/db";
import { makeDeps } from "../../../src/infra/deps";
import type { TestEnv } from "../harness";

/** Tabelas de catálogo global, pequenas e fixas: ler inteiras é o certo. */
const GLOBAL_CATALOGS = new Set(["units", "movement_reasons"]);

/**
 * Dependências cujas consultas passam por uma sessão com `auto_explain` (plano de toda consulta,
 * enviado ao cliente como aviso) e `enable_seqscan = off`: com a leitura sequencial desligada, o
 * PostgreSQL só lê a tabela inteira quando nenhum índice serve (spec 012, R2). A sessão entra como
 * superusuário só para carregar o `auto_explain` e já começa como `app_user`, sujeita ao RLS.
 */
export function explainingEnv(env: TestEnv) {
  const settings = {
    session_preload_libraries: "auto_explain",
    "auto_explain.log_min_duration": "0",
    "auto_explain.log_level": "notice",
    "auto_explain.log_nested_statements": "on",
    enable_seqscan: "off",
    role: "app_user",
  };
  const pool = new Pool({
    connectionString: inject("ownerUrl"),
    max: 1,
    options: Object.entries(settings)
      .map(([k, v]) => `-c ${k}=${v}`)
      .join(" "),
  });
  const plans: string[] = [];
  pool.on("connect", (client) => client.on("notice", (n) => plans.push(n.message ?? "")));
  const db = drizzle(pool, { schema }) as unknown as Db;
  const deps = makeDeps({
    db,
    mailer: env.mailer,
    clock: env.clock,
    appUrl: "http://localhost:3000",
    authSecret: "segredo-de-teste-com-mais-de-32-caracteres",
    photos: env.deps.photos,
  });

  /** Leituras da tabela inteira desde a última chamada: "tabela ← consulta". */
  function fullScans(): string[] {
    const found = plans.flatMap((plan) => {
      const query =
        /Query Text: ([\s\S]*?)(?:\n\S|$)/.exec(plan)?.[1]?.replace(/\s+/g, " ").slice(0, 160) ?? "";
      return [...plan.matchAll(/Seq Scan on (\w+)/g)]
        .map((m) => m[1]!)
        .filter((t) => !GLOBAL_CATALOGS.has(t))
        .map((t) => `${t} ← ${query}`);
    });
    plans.length = 0;
    return [...new Set(found)];
  }

  /** Papel efetivo da sessão (deve ser `app_user`, para o RLS valer como na aplicação). */
  async function currentRole(): Promise<string> {
    const r = await pool.query<{ u: string }>("select current_user as u");
    plans.length = 0;
    return r.rows[0]!.u;
  }

  return { deps, fullScans, currentRole, planCount: () => plans.length, close: () => pool.end() };
}

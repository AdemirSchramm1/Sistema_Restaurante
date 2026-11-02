import { inject } from "vitest";
import { createDb, type Db } from "../../src/infra/db/db";
import { makeDeps } from "../../src/infra/deps";
import { MemoryMailer } from "../../src/infra/mailer/memory";
import type { Clock, Deps } from "../../src/application/ports";
import type { RequestContext } from "../../src/application/context";
import type { Role } from "../../src/domain/access/permissions";
import { signUpRestaurant } from "../../src/application/access/sign-up-restaurant";

let appDb: Db | undefined;
let ownerDb: Db | undefined;

/** Banco com o papel da aplicação (sujeito ao RLS). */
export const testDb = () => (appDb ??= createDb(inject("appUrl"), 5));
/** Banco com o papel dono (ignora RLS). Só para preparar e inspecionar cenários. */
export const ownerTestDb = () => (ownerDb ??= createDb(inject("ownerUrl"), 2));

export async function closeTestDbs() {
  await appDb?.$client.end();
  await ownerDb?.$client.end();
  appDb = ownerDb = undefined;
}

const TABLES = [
  "recipe_lines",
  "recipe_versions",
  "recipes",
  "audit_log",
  "items",
  "item_subgroups",
  "item_groups",
  "invitations",
  "membership_roles",
  "memberships",
  "restaurants",
  "sessions",
  "accounts",
  "verifications",
  "users",
];

export async function resetDatabase() {
  await ownerTestDb().$client.query(`TRUNCATE ${TABLES.join(", ")} CASCADE`);
}

export class FixedClock implements Clock {
  constructor(public current = new Date("2026-10-31T12:00:00Z")) {}
  now() {
    return new Date(this.current);
  }
  advance(ms: number) {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export type TestEnv = { deps: Deps; mailer: MemoryMailer; clock: FixedClock };

export function testEnv(): TestEnv {
  const mailer = new MemoryMailer();
  const clock = new FixedClock();
  const deps = makeDeps({
    db: testDb(),
    mailer,
    clock,
    appUrl: "http://localhost:3000",
    authSecret: "segredo-de-teste-com-mais-de-32-caracteres",
  });
  return { deps, mailer, clock };
}

let seq = 0;
/** Cria restaurante com gerente e devolve o contexto do gerente. */
export async function newRestaurant(env: TestEnv, name = "Restaurante Teste"): Promise<RequestContext> {
  seq += 1;
  const email = `gerente${seq}-${Date.now()}@teste.com.br`;
  const r = await signUpRestaurant(
    env.deps,
    { restaurantName: name, userName: "Gerente", email, password: "senha-forte-123" },
    { channel: "test" },
  );
  if (!r.ok) throw new Error(`signUp falhou: ${JSON.stringify(r.error)}`);
  return contextFor(r.value, ["MANAGER"]);
}

export function contextFor(
  v: { userId: string; restaurantId: string; membershipId: string },
  roles: Role[],
): RequestContext {
  return { ...v, roles, origin: { channel: "test" } };
}

/** Acrescenta um membro com os papéis dados, direto pelo repositório (atalho de teste). */
export async function addMember(
  env: TestEnv,
  manager: RequestContext,
  roles: Role[],
  name = "Membro",
): Promise<RequestContext> {
  seq += 1;
  const created = await env.deps.auth.createUser({
    email: `membro${seq}-${Date.now()}@teste.com.br`,
    password: "senha-forte-123",
    name,
  });
  if (!created.ok) throw new Error("createUser falhou");
  const membershipId = env.deps.ids.next();
  await env.deps.tenant(manager.restaurantId, async (repos) => {
    await repos.members.create(
      { id: membershipId, userId: created.value.userId, roles },
      { at: env.clock.now(), by: manager.userId },
    );
    return { ok: true, value: undefined };
  });
  return contextFor(
    { userId: created.value.userId, restaurantId: manager.restaurantId, membershipId },
    roles,
  );
}

/** Id do subgrupo pelos códigos (ex.: "01", "02" = Hortifrúti > Legumes). */
export async function subgroupId(
  env: TestEnv,
  ctx: RequestContext,
  groupCode: string,
  subCode: string,
): Promise<string> {
  const r = await env.deps.tenant(ctx.restaurantId, async (repos) => ({
    ok: true as const,
    value: await repos.groups.tree(true),
  }));
  if (!r.ok) throw new Error("tree");
  const g = r.value.find((x) => x.code === groupCode);
  const s = g?.subgroups.find((x) => x.code === subCode);
  if (!s) throw new Error(`subgrupo ${groupCode}.${subCode} não existe`);
  return s.id;
}

import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { newRestaurant, ownerTestDb, testEnv } from "../harness";
import { code, orderingScenario, tablet, tableWithQr, unwrap } from "./fixtures";
import { submitOrder } from "../../../src/application/ordering/submit-order";
import { createTabletLink, releaseTablet, rotateTabletLink } from "../../../src/application/ordering/tablets";
import type { Deps } from "../../../src/application/ports";
import { d } from "../../../src/domain/shared/decimal";
import { ok } from "../../../src/domain/shared/result";

/** Spec 018, US3: recusas do envio do pedido pelo tablet (spec 016) e bordas que faltavam. */

const version = async (tableId: string) =>
  (
    await ownerTestDb().execute<{ version: number }>(
      sql`select version from dining_tables where id = ${tableId}`,
    )
  ).rows[0]!.version;

describe("enviar pedido pelo tablet: recusas (spec 016, US4)", () => {
  it("tablet liberado é TABLET_RELEASED; tablet com o link trocado é TABLET_LINK_INVALID", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    const send = (cookie: string) =>
      submitOrder(
        env.deps,
        { qr: null, tablet: cookie },
        { clientRequestId: crypto.randomUUID(), lines: [s.juice()] },
      );

    const first = await tablet(env, m, s.table.tableId);
    unwrap(await releaseTablet(env.deps, m, { tableId: s.table.tableId }));
    expect(code(await send(first))).toBe("TABLET_RELEASED");

    const second = await tablet(env, m, s.table.tableId);
    unwrap(
      await rotateTabletLink(env.deps, m, {
        tableId: s.table.tableId,
        version: await version(s.table.tableId),
      }),
    );
    expect(code(await send(second))).toBe("TABLET_LINK_INVALID");
  });

  it("acesso que a busca acha mas o restaurante não tem: ACCESS_EXPIRED", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    const deps = {
      ...env.deps,
      global: {
        ...env.deps.global,
        menuAccessByTokenHash: async () => ({
          restaurantId: m.restaurantId,
          menuAccessId: crypto.randomUUID(),
          kind: "QR" as const,
        }),
      },
    };
    expect(
      code(await submitOrder(deps, "x", { clientRequestId: crypto.randomUUID(), lines: [s.juice()] })),
    ).toBe("ACCESS_EXPIRED");
  });
});

describe("enviar pedido: toque repetido e produto que não existe (spec 009, US3)", () => {
  it("o outro toque gravou entre a conferência e a gravação: devolve o pedido dele", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    const clientRequestId = crypto.randomUUID();
    const first = unwrap(await submitOrder(env.deps, s.cookie, { clientRequestId, lines: [s.juice()] }));
    let hidden = false;
    // O primeiro toque ainda não aparece na conferência, como se os dois chegassem juntos.
    const racy: Deps = {
      ...env.deps,
      tenant: (restaurantId, fn) =>
        env.deps.tenant(restaurantId, (repos) =>
          fn({
            ...repos,
            orders: {
              ...repos.orders,
              findByClientRequest: async (...a: Parameters<typeof repos.orders.findByClientRequest>) => {
                if (!hidden) {
                  hidden = true;
                  return null;
                }
                return repos.orders.findByClientRequest(...a);
              },
            },
          }),
        ),
    };
    const again = unwrap(await submitOrder(racy, s.cookie, { clientRequestId, lines: [s.juice()] }));
    expect(again).toEqual(first);
    const n = await ownerTestDb().execute<{ n: number }>(
      sql`select count(*)::int as n from orders where restaurant_id = ${m.restaurantId}`,
    );
    expect(n.rows[0]!.n).toBe(1);
  });

  it("produto que não existe é PRODUCT_UNAVAILABLE", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    const ghost = { ...s.juice(), recipeId: crypto.randomUUID() };
    expect(
      code(await submitOrder(env.deps, s.cookie, { clientRequestId: crypto.randomUUID(), lines: [ghost] })),
    ).toBe("PRODUCT_UNAVAILABLE");
  });

  it("erro do banco que não é toque repetido sobe como erro", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    await expect(
      env.deps.tenant(m.restaurantId, async (repos) =>
        ok(
          await repos.orders.insert({
            id: "x",
            tableId: s.table.tableId,
            tabId: null,
            origin: { source: "QR", menuAccessId: crypto.randomUUID() },
            clientRequestId: crypto.randomUUID(),
            businessDay: "2026-11-27",
            total: d("1"),
            submittedAt: env.clock.now(),
            lines: [],
          } as never),
        ),
      ),
    ).rejects.toThrow();
  });
});

describe("trocar o link do tablet (spec 016, US2)", () => {
  it("sem tablet ligado, troca só o link", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const t = await tableWithQr(env, m, "7");
    unwrap(await createTabletLink(env.deps, m, { tableId: t.tableId, version: await version(t.tableId) }));
    const before = (
      await ownerTestDb().execute<{ t: string }>(
        sql`select tablet_token as t from dining_tables where id = ${t.tableId}`,
      )
    ).rows[0]!.t;
    unwrap(await rotateTabletLink(env.deps, m, { tableId: t.tableId, version: await version(t.tableId) }));
    const after = (
      await ownerTestDb().execute<{ t: string; n: number }>(
        sql`select tablet_token as t, (select count(*)::int from menu_accesses where table_id = ${t.tableId}) as n
            from dining_tables where id = ${t.tableId}`,
      )
    ).rows[0]!;
    expect(after.t).not.toBe(before);
    expect(after.n).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import { addMember, newRestaurant, ownerTestDb, testEnv } from "../harness";
import { code, orderingScenario, unwrap } from "./fixtures";
import {
  advanceOrderStatus,
  cancelOrder,
  listDishesForKitchen,
  setProductSoldOut,
} from "../../../src/application/ordering/kitchen";
import type { Deps } from "../../../src/application/ports";

/** Spec 018, US3: recusas e corridas da cozinha (docs/produto/pedidos/03) que faltavam. */

const q = (text: string, params: unknown[] = []) => ownerTestDb().$client.query(text, params);
const MISSING = "00000000-0000-4000-8000-000000000000";

/** Pedido lançado pelo garçom na mesa do cenário (spec 015). */
async function staffOrder(
  env: ReturnType<typeof testEnv>,
  s: Awaited<ReturnType<typeof orderingScenario>>,
  waiter: Awaited<ReturnType<typeof addMember>>,
) {
  const { placeStaffOrder } = await import("../../../src/application/ordering/staff-orders");
  return unwrap(
    await placeStaffOrder(env.deps, waiter, {
      tableId: s.table.tableId,
      clientRequestId: crypto.randomUUID(),
      tabIdSeen: null,
      lines: [{ ...s.juice(), kitchenNote: null }],
    }),
  ).orderId;
}

async function setup() {
  const env = testEnv();
  const m = await newRestaurant(env);
  const s = await orderingScenario(env, m);
  const chef = await addMember(env, m, ["CHEF"], "Chef Ana");
  const waiter = await addMember(env, m, ["WAITER"], "Garçom Beto");
  const stock = await addMember(env, m, ["STOCKKEEPER"], "Estoque");
  return { env, m, s, chef, waiter, stock };
}

describe("cozinha: recusas (spec 009, US4)", () => {
  it("a cozinha só move para Em preparo ou Pronto; quem não é da cozinha é FORBIDDEN antes", async () => {
    const { env, s, chef, waiter } = await setup();
    const { orderId: id } = await s.place([s.juice()]);
    const r = await advanceOrderStatus(env.deps, chef, { id, to: "DELIVERED", version: 1 });
    expect(r.ok ? null : [r.error.code, r.error.details]).toEqual([
      "INVALID_ORDER_TRANSITION",
      { to: "DELIVERED" },
    ]);
    expect(code(await advanceOrderStatus(env.deps, waiter, { id, to: "CANCELLED", version: 1 }))).toBe(
      "FORBIDDEN",
    );
    expect(code(await advanceOrderStatus(env.deps, chef, { id: MISSING, to: "PREPARING", version: 1 }))).toBe(
      "NOT_FOUND",
    );
  });

  it("cancelar: sem permissão nenhuma é FORBIDDEN com registro; pedido que não existe é NOT_FOUND", async () => {
    const { env, m, s, stock } = await setup();
    const { orderId: id } = await s.place([s.juice()]);
    const cancel = (ctx: typeof m, orderId: string, version = 1) =>
      cancelOrder(env.deps, ctx, { id: orderId, reason: "CUSTOMER_GAVE_UP", note: null, version });
    expect(code(await cancel(stock, id))).toBe("FORBIDDEN");
    const denied = await q(
      "select changes from audit_log where entity = 'order' and entity_id = $1 and action = 'DENIED'",
      [id],
    );
    expect(denied.rows.map((r) => r.changes)).toEqual([{ action: "order.cancel" }]);
    expect(code(await cancel(m, MISSING))).toBe("NOT_FOUND");
    expect(code(await cancel(m, id, 2))).toBe("STALE_RECORD");
    expect((await q("select status from orders where id = $1", [id])).rows[0].status).toBe("RECEIVED");
  });

  it("garçom não cancela pedido do QR code, nem com versão velha: FORBIDDEN", async () => {
    const { env, s, waiter } = await setup();
    const { orderId: id } = await s.place([s.juice()]);
    expect(
      code(await cancelOrder(env.deps, waiter, { id, reason: "CUSTOMER_GAVE_UP", note: null, version: 9 })),
    ).toBe("FORBIDDEN");
  });

  it("garçom que lançou: versão velha com o pedido ainda Recebido é STALE_RECORD", async () => {
    const { env, s, waiter } = await setup();
    const id = await staffOrder(env, s, waiter);
    expect(
      code(await cancelOrder(env.deps, waiter, { id, reason: "ENTERED_BY_MISTAKE", note: null, version: 9 })),
    ).toBe("STALE_RECORD");
  });

  it("garçom perde a corrida para o Começar preparo: vê A cozinha já começou (spec 015, R6)", async () => {
    const { env, s, chef, waiter } = await setup();
    const id = await staffOrder(env, s, waiter);
    let raced = false;
    // A cozinha começa entre a leitura do pedido e a gravação do cancelamento do garçom.
    const racy: Deps = {
      ...env.deps,
      tenant: (restaurantId, fn) =>
        env.deps.tenant(restaurantId, (repos) =>
          fn({
            ...repos,
            orders: {
              ...repos.orders,
              changeStatus: async (...a: Parameters<typeof repos.orders.changeStatus>) => {
                if (!raced) {
                  raced = true;
                  unwrap(await advanceOrderStatus(env.deps, chef, { id, to: "PREPARING", version: 1 }));
                }
                return repos.orders.changeStatus(...a);
              },
            },
          }),
        ),
    };
    expect(
      code(await cancelOrder(racy, waiter, { id, reason: "ENTERED_BY_MISTAKE", note: null, version: 1 })),
    ).toBe("KITCHEN_STARTED");
    expect((await q("select status from orders where id = $1", [id])).rows[0].status).toBe("PREPARING");
  });

  it("pedido antigo, de antes da conta da mesa, cancela sem mexer em conta nenhuma", async () => {
    const { env, m, s } = await setup();
    const { orderId: id } = await s.place([s.juice()]);
    const tab = (await q("select tab_id from orders where id = $1", [id])).rows[0].tab_id;
    // Pedido de antes da migração 0011: a coluna veio vazia. O gatilho só deixa mudar a situação,
    // então o teste desliga os gatilhos só nesta transação para montar o pedido antigo.
    const c = await ownerTestDb().$client.connect();
    try {
      await c.query("begin");
      await c.query("set local session_replication_role = replica");
      await c.query("update orders set tab_id = null where id = $1", [id]);
      await c.query("commit");
    } finally {
      c.release();
    }
    const before = (await q("select version from table_tabs where id = $1", [tab])).rows[0].version;
    unwrap(await cancelOrder(env.deps, m, { id, reason: "CUSTOMER_GAVE_UP", note: null, version: 1 }));
    expect((await q("select version from table_tabs where id = $1", [tab])).rows[0].version).toBe(before);
  });
});

describe("esgotado hoje (spec 009, US5)", () => {
  it("quem não é da cozinha não vê a lista; marcar o que já está marcado não grava auditoria", async () => {
    const { env, m, s, waiter } = await setup();
    expect(code(await listDishesForKitchen(env.deps, waiter))).toBe("FORBIDDEN");
    unwrap(await setProductSoldOut(env.deps, m, { recipeId: s.suco, soldOut: true }));
    unwrap(await setProductSoldOut(env.deps, m, { recipeId: s.suco, soldOut: true }));
    const audit = await q(
      "select changes from audit_log where entity = 'recipe' and entity_id = $1 and action = 'UPDATE' and changes ? 'soldOutOn'",
      [s.suco],
    );
    expect(audit.rowCount).toBe(1);
  });
});

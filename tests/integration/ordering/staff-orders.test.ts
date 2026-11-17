import { describe, it, expect } from "vitest";
import { addMember, newRestaurant, ownerTestDb, testEnv, type TestEnv } from "../harness";
import { code, unwrap } from "./fixtures";
import { billingScenario } from "../billing/fixtures";
import {
  getStaffMenu,
  listTableOrders,
  listTablesForStaff,
  placeStaffOrder,
} from "../../../src/application/ordering/staff-orders";
import { submitOrder } from "../../../src/application/ordering/submit-order";
import { setTableActive } from "../../../src/application/ordering/tables";
import {
  getOrder,
  listOrders,
  ordersBySource,
  setAcceptingQrOrders,
} from "../../../src/application/ordering/orders";
import {
  advanceOrderStatus,
  cancelOrder,
  listKitchenOrders,
  listReadyOrders,
  setProductSoldOut,
} from "../../../src/application/ordering/kitchen";
import { setRecipeSalePrice } from "../../../src/application/inventory/product-costs";
import { d } from "../../../src/domain/shared/decimal";

/**
 * Garçom lança o pedido da mesa (spec 015, US1): Mesa 12 da 011 com X-Burger (+ 2 Fatia de queijo,
 * sem cebola) a R$ 34,00 e Suco a R$ 9,00; João e Maria são garçons.
 */
async function staffScenario(env: TestEnv) {
  const b = await billingScenario(env);
  const joao = await addMember(env, b.m, ["WAITER"], "João");
  const maria = await addMember(env, b.m, ["WAITER"], "Maria");
  const tableId = b.s.table.tableId;
  const burger = (quantity = 2, kitchenNote: string | null = null) => ({
    ...b.s.burger(quantity),
    kitchenNote,
  });
  const juice = (quantity = 1) => ({ ...b.s.juice(quantity), kitchenNote: null });
  const input = (lines: unknown[], over: Record<string, unknown> = {}) => ({
    tableId,
    clientRequestId: crypto.randomUUID(),
    tabIdSeen: null,
    lines,
    ...over,
  });
  return { ...b, joao, maria, tableId, burger, juice, input };
}

const q = (text: string, params: unknown[] = []) => ownerTestDb().$client.query(text, params);

describe("lançar pedido pela equipe (spec 015, US1, FR-001 a FR-007)", () => {
  it("João lança 2 X-Burger com queijo e sem cebola na Mesa 12: origem, quem lançou, conta e auditoria", async () => {
    const env = testEnv();
    const t = await staffScenario(env);
    const r = unwrap(await placeStaffOrder(env.deps, t.joao, t.input([t.burger(2, "mal passado")])));
    expect(r).toEqual({
      orderId: expect.any(String),
      number: 1,
      total: "68.00",
      tableName: "12",
      previousTabClosed: false,
    });
    const order = (
      await q("select source, placed_by, menu_access_id, created_by, tab_id from orders where id = $1", [
        r.orderId,
      ])
    ).rows[0];
    expect(order).toMatchObject({
      source: "STAFF",
      placed_by: t.joao.userId,
      menu_access_id: null,
      created_by: t.joao.userId,
    });
    const line = (await q("select kitchen_note from order_lines where order_id = $1", [r.orderId])).rows;
    expect(line).toEqual([{ kitchen_note: "mal passado" }]);
    const event = (
      await q("select user_id, to_status from order_status_events where order_id = $1", [r.orderId])
    ).rows;
    expect(event).toEqual([{ user_id: t.joao.userId, to_status: "RECEIVED" }]);
    const opened = (
      await q("select user_id, details from tab_events where tab_id = $1 and kind = 'OPENED'", [order.tab_id])
    ).rows;
    expect(opened).toEqual([{ user_id: t.joao.userId, details: { orderId: r.orderId } }]);
    const audit = (
      await q("select action, user_id, changes from audit_log where entity = 'order' and entity_id = $1", [
        r.orderId,
      ])
    ).rows;
    expect(audit).toEqual([
      {
        action: "CREATE",
        user_id: t.joao.userId,
        changes: { source: "STAFF", tableId: t.tableId, number: 1, total: "68.00" },
      },
    ]);
  });

  it("o número segue a sequência do dia do QR code e o pedido entra na mesma conta", async () => {
    const env = testEnv();
    const t = await staffScenario(env);
    const qr = unwrap(
      await submitOrder(env.deps, t.s.cookie, { clientRequestId: crypto.randomUUID(), lines: [t.s.juice()] }),
    );
    const staff = unwrap(await placeStaffOrder(env.deps, t.joao, t.input([t.juice()])));
    expect([qr.number, staff.number]).toEqual([1, 2]);
    const tabs = (await q("select distinct tab_id from orders where table_id = $1", [t.tableId])).rows;
    expect(tabs).toHaveLength(1);
  });

  it("QR code desligado e acesso com 10 pedidos não seguram o garçom (FR-004)", async () => {
    const env = testEnv();
    const t = await staffScenario(env);
    for (let i = 0; i < 10; i++) await t.s.place([t.s.juice()]);
    const settings = (await q("select version from restaurants where id = $1", [t.m.restaurantId])).rows[0];
    unwrap(await setAcceptingQrOrders(env.deps, t.m, { accepting: false, version: settings.version }));
    expect(code(await placeStaffOrder(env.deps, t.joao, t.input([t.juice()])))).toBe("OK");
  });

  it("caixa e gerente também lançam; chef não (FR-001), com a tentativa registrada", async () => {
    const env = testEnv();
    const t = await staffScenario(env);
    expect(code(await placeStaffOrder(env.deps, t.cashier, t.input([t.juice()])))).toBe("OK");
    expect(code(await placeStaffOrder(env.deps, t.m, t.input([t.juice()])))).toBe("OK");
    expect(code(await placeStaffOrder(env.deps, t.chef, t.input([t.juice()])))).toBe("FORBIDDEN");
    const denied = (
      await q("select count(*)::int as n from audit_log where action = 'DENIED' and user_id = $1", [
        t.chef.userId,
      ])
    ).rows[0];
    expect(denied.n).toBe(1);
  });

  it("mesa inativa, de outro restaurante ou inexistente", async () => {
    const env = testEnv();
    const t = await staffScenario(env);
    const other = await newRestaurant(env, "Outro");
    const table = (await q("select version from dining_tables where id = $1", [t.tableId])).rows[0];
    unwrap(await setTableActive(env.deps, t.m, { id: t.tableId, active: false, version: table.version }));
    const r = await placeStaffOrder(env.deps, t.joao, t.input([t.juice()]));
    expect(r.ok ? null : r.error).toEqual({
      code: "STAFF_TABLE_INACTIVE",
      details: { tableName: "12" },
    });
    expect(code(await placeStaffOrder(env.deps, other, t.input([t.juice()])))).toBe("NOT_FOUND");
    expect(
      code(await placeStaffOrder(env.deps, t.joao, t.input([t.juice()], { tableId: crypto.randomUUID() }))),
    ).toBe("NOT_FOUND");
  });

  it("observação de 141 letras, preço que mudou e produto esgotado: nada é gravado", async () => {
    const env = testEnv();
    const t = await staffScenario(env);
    const long = await placeStaffOrder(env.deps, t.joao, t.input([t.juice(), t.burger(1, "a".repeat(141))]));
    expect(long.ok ? null : long.error).toMatchObject({
      code: "NOTE_TOO_LONG",
      field: "lines.1.kitchenNote",
    });
    unwrap(await setRecipeSalePrice(env.deps, t.m, t.s.suco, 2, d("10.00")));
    expect(code(await placeStaffOrder(env.deps, t.joao, t.input([t.juice()])))).toBe("PRICE_CHANGED");
    unwrap(await setProductSoldOut(env.deps, t.m, { recipeId: t.s.burgerId, soldOut: true }));
    expect(code(await placeStaffOrder(env.deps, t.joao, t.input([t.burger()])))).toBe("PRODUCT_UNAVAILABLE");
    expect(code(await placeStaffOrder(env.deps, t.joao, t.input([])))).toBe("EMPTY_ORDER");
    expect(
      (await q("select count(*)::int as n from orders where table_id = $1", [t.tableId])).rows[0].n,
    ).toBe(0);
  });

  it("o mesmo envio duas vezes devolve o mesmo pedido; com outro conteúdo é recusado (FR-011)", async () => {
    const env = testEnv();
    const t = await staffScenario(env);
    const input = t.input([t.burger(2, "mal passado"), t.juice()]);
    const first = unwrap(await placeStaffOrder(env.deps, t.joao, input));
    const again = unwrap(
      await placeStaffOrder(env.deps, t.joao, { ...input, lines: [...input.lines].reverse() }),
    );
    expect(again).toEqual(first);
    const changed = { ...input, lines: [t.burger(3, "mal passado"), t.juice()] };
    expect(code(await placeStaffOrder(env.deps, t.joao, changed))).toBe("REQUEST_REUSED");
    // Outra pessoa pode usar o mesmo id: o envio é de cada um.
    expect(code(await placeStaffOrder(env.deps, t.maria, input))).toBe("OK");
    expect(
      (await q("select count(*)::int as n from orders where table_id = $1", [t.tableId])).rows[0].n,
    ).toBe(2);
  });

  it("toque duplo ao mesmo tempo grava um pedido só", async () => {
    const env = testEnv();
    const t = await staffScenario(env);
    const input = t.input([t.juice()]);
    const [a, b] = await Promise.all([
      placeStaffOrder(env.deps, t.joao, input),
      placeStaffOrder(env.deps, t.joao, input),
    ]);
    expect(unwrap(a).orderId).toBe(unwrap(b).orderId);
  });

  it("QR code e equipe ao mesmo tempo na mesa sem conta abrem uma conta só (SC-003)", async () => {
    const env = testEnv();
    const t = await staffScenario(env);
    await Promise.all([
      placeStaffOrder(env.deps, t.joao, t.input([t.juice()])),
      submitOrder(env.deps, t.s.cookie, { clientRequestId: crypto.randomUUID(), lines: [t.s.juice()] }),
    ]);
    const tabs = (await q("select count(*)::int as n from table_tabs where table_id = $1", [t.tableId]))
      .rows[0];
    expect(tabs.n).toBe(1);
  });

  it("conta vista no aparelho já fechada: o pedido abre outra e avisa", async () => {
    const env = testEnv();
    const t = await staffScenario(env);
    const r = unwrap(
      await placeStaffOrder(env.deps, t.joao, t.input([t.juice()], { tabIdSeen: crypto.randomUUID() })),
    );
    expect(r.previousTabClosed).toBe(true);
    const tabId = await t.tabId();
    const same = unwrap(await placeStaffOrder(env.deps, t.joao, t.input([t.juice()], { tabIdSeen: tabId })));
    expect(same.previousTabClosed).toBe(false);
  });
});

describe("grade de mesas e cardápio da equipe (spec 015, US1-1, US1-2, US1-9)", () => {
  it("mesas ativas na ordem do nome, com a conta aberta, o total e os prontos", async () => {
    const env = testEnv();
    const t = await staffScenario(env);
    const four = await t.placeAt("4", [t.s.juice()]);
    const order = unwrap(await placeStaffOrder(env.deps, t.joao, t.input([t.burger()])));
    await t.advance(order.orderId, "PREPARING");
    await t.advance(order.orderId, "READY");
    await t.placeAt("30", [t.s.juice()]);
    const inactive = (await q("select id, version from dining_tables where name = '30'")).rows[0];
    unwrap(
      await setTableActive(env.deps, t.m, { id: inactive.id, active: false, version: inactive.version }),
    );
    const grid = unwrap(await listTablesForStaff(env.deps, t.joao));
    expect(grid.qrOrdersOff).toBe(false);
    expect(
      grid.tables.map((x) => [x.name, x.tab ? x.tab.total : null, x.readyCount, x.tab?.id ?? null]),
    ).toEqual([
      ["4", "9.90", 0, four.tabId],
      ["12", "74.80", 1, await t.tabId()],
    ]);
    expect(grid.tables[0]!.tab!.openedAt).toEqual(expect.any(String));
  });

  it("com o QR code desligado, a grade avisa", async () => {
    const env = testEnv();
    const t = await staffScenario(env);
    const settings = (await q("select version from restaurants where id = $1", [t.m.restaurantId])).rows[0];
    unwrap(await setAcceptingQrOrders(env.deps, t.m, { accepting: false, version: settings.version }));
    expect(unwrap(await listTablesForStaff(env.deps, t.joao)).qrOrdersOff).toBe(true);
    expect(code(await listTablesForStaff(env.deps, t.chef))).toBe("FORBIDDEN");
  });

  it("cardápio da mesa: esgotado no fim, apagado, sem adicionais; mesa inativa e outra mesa", async () => {
    const env = testEnv();
    const t = await staffScenario(env);
    unwrap(await setProductSoldOut(env.deps, t.m, { recipeId: t.s.burgerId, soldOut: true }));
    const menu = unwrap(await getStaffMenu(env.deps, t.joao, t.tableId));
    expect(menu.table).toEqual({ id: t.tableId, name: "12" });
    expect(menu.tab).toBeNull();
    const products = menu.sections.flatMap((s) => s.products);
    expect(products.map((p) => [p.name, p.soldOut, p.price, p.addons.length, p.removables.length])).toEqual([
      ["Suco", false, "9.00", 0, 0],
      ["X-Burger", true, "28.00", 0, 0],
    ]);
    unwrap(await setProductSoldOut(env.deps, t.m, { recipeId: t.s.burgerId, soldOut: false }));
    const back = unwrap(await getStaffMenu(env.deps, t.joao, t.tableId)).sections.flatMap((s) => s.products);
    expect(back.find((p) => p.name === "X-Burger")).toMatchObject({
      soldOut: false,
      addons: [{ name: "Fatia de queijo", price: "3.00", maxTimes: 2 }],
      removables: [{ label: "Sem cebola" }],
    });
    unwrap(await placeStaffOrder(env.deps, t.joao, t.input([t.juice()])));
    expect(unwrap(await getStaffMenu(env.deps, t.joao, t.tableId)).tab).toEqual({
      id: await t.tabId(),
      total: "9.90",
    });
    const table = (await q("select version from dining_tables where id = $1", [t.tableId])).rows[0];
    unwrap(await setTableActive(env.deps, t.m, { id: t.tableId, active: false, version: table.version }));
    expect(code(await getStaffMenu(env.deps, t.joao, t.tableId))).toBe("STAFF_TABLE_INACTIVE");
    expect(code(await getStaffMenu(env.deps, t.joao, crypto.randomUUID()))).toBe("NOT_FOUND");
    expect(code(await getStaffMenu(env.deps, t.joao, "12"))).toBe("NOT_FOUND");
  });
});

describe("Pedidos da mesa (spec 015, US3, FR-009)", () => {
  it("pedidos da conta aberta de todas as origens, mais novo primeiro, com o total da conta", async () => {
    const env = testEnv();
    const t = await staffScenario(env);
    const qr = unwrap(
      await submitOrder(env.deps, t.s.cookie, { clientRequestId: crypto.randomUUID(), lines: [t.s.juice()] }),
    );
    await t.advance(qr.orderId, "PREPARING");
    env.clock.advance(60_000);
    const mine = unwrap(await placeStaffOrder(env.deps, t.joao, t.input([t.burger(2, "mal passado")])));
    await t.advance(mine.orderId, "PREPARING");
    await t.advance(mine.orderId, "READY");
    env.clock.advance(60_000);
    const maria = unwrap(await placeStaffOrder(env.deps, t.maria, t.input([t.juice()])));

    const view = unwrap(await listTableOrders(env.deps, t.joao, t.tableId));
    expect(view.table).toEqual({ id: t.tableId, name: "12" });
    expect(view.tab).toMatchObject({
      subtotal: "86.00",
      serviceCharge: "8.60",
      total: "94.60",
      paid: "0.00",
      remaining: "94.60",
    });
    expect(
      view.orders.map((o) => [
        o.number,
        o.source,
        o.placedByName,
        o.status,
        o.total,
        o.canCancel,
        o.canDeliver,
      ]),
    ).toEqual([
      [maria.number, "STAFF", "Maria", "RECEIVED", "9.00", false, false],
      [mine.number, "STAFF", "João", "READY", "68.00", false, true],
      [qr.number, "QR", null, "PREPARING", "9.00", false, false],
    ]);
    expect(view.orders[1]!.lines).toEqual([
      {
        quantity: 2,
        productName: "X-Burger",
        changes: ["+ 2 Fatia de queijo", "SEM cebola"],
        kitchenNote: "mal passado",
        again: {
          recipeId: t.s.burgerId,
          quantity: 2,
          addons: [{ addonId: t.s.cheese, times: 2 }],
          removals: [{ kind: "ITEM", id: t.s.cebola }],
          kitchenNote: "mal passado",
        },
      },
    ]);
    const own = unwrap(await placeStaffOrder(env.deps, t.joao, t.input([t.juice()])));
    const after = unwrap(await listTableOrders(env.deps, t.joao, t.tableId));
    expect(after.orders.find((o) => o.id === own.orderId)!.canCancel).toBe(true);
  });

  it("mesa sem conta aberta; outra mesa; quem não lança", async () => {
    const env = testEnv();
    const t = await staffScenario(env);
    expect(unwrap(await listTableOrders(env.deps, t.joao, t.tableId))).toMatchObject({
      tab: null,
      orders: [],
    });
    expect(code(await listTableOrders(env.deps, t.joao, crypto.randomUUID()))).toBe("NOT_FOUND");
    expect(code(await listTableOrders(env.deps, t.chef, t.tableId))).toBe("FORBIDDEN");
  });
});

describe("quem lançou cada pedido (spec 015, US2, FR-008)", () => {
  it("cozinha e Garçom mostram a origem e a observação; Só os meus filtra os prontos", async () => {
    const env = testEnv();
    const t = await staffScenario(env);
    const qr = unwrap(
      await submitOrder(env.deps, t.s.cookie, { clientRequestId: crypto.randomUUID(), lines: [t.s.juice()] }),
    );
    const joao = unwrap(await placeStaffOrder(env.deps, t.joao, t.input([t.burger(1, "mal passado")])));
    const maria = unwrap(await placeStaffOrder(env.deps, t.maria, t.input([t.juice()])));
    const kitchen = unwrap(await listKitchenOrders(env.deps, t.chef)).orders;
    expect(kitchen.map((o) => [o.number, o.source, o.placedByName])).toEqual([
      [qr.number, "QR", null],
      [joao.number, "STAFF", "João"],
      [maria.number, "STAFF", "Maria"],
    ]);
    expect(kitchen[1]!.lines[0]!.kitchenNote).toBe("mal passado");
    for (const id of [qr.orderId, joao.orderId, maria.orderId]) {
      await t.advance(id, "PREPARING");
      await t.advance(id, "READY");
    }
    const all = unwrap(await listReadyOrders(env.deps, t.joao));
    expect(all.map((o) => o.placedByName)).toEqual([null, "João", "Maria"]);
    const mine = unwrap(await listReadyOrders(env.deps, t.joao, { onlyMine: true }));
    expect(mine.map((o) => [o.number, o.placedById])).toEqual([[joao.number, t.joao.userId]]);
  });

  it("consulta filtra por Lançado por e resume por origem, com cancelados por motivo (SC-005)", async () => {
    const env = testEnv();
    const t = await staffScenario(env);
    const day = "2026-10-31";
    await t.s.place([t.s.juice()]);
    const cancelledQr = await t.s.place([t.s.juice()]);
    const j1 = unwrap(await placeStaffOrder(env.deps, t.joao, t.input([t.burger()])));
    const j2 = unwrap(await placeStaffOrder(env.deps, t.joao, t.input([t.juice(2)])));
    const j3 = unwrap(await placeStaffOrder(env.deps, t.joao, t.input([t.juice()])));
    unwrap(await placeStaffOrder(env.deps, t.maria, t.input([t.juice()])));
    unwrap(
      await cancelOrder(env.deps, t.chef, {
        id: cancelledQr.orderId,
        reason: "CUSTOMER_GAVE_UP",
        note: null,
        version: 1,
      }),
    );
    unwrap(
      await cancelOrder(env.deps, t.joao, {
        id: j3.orderId,
        reason: "ENTERED_BY_MISTAKE",
        note: null,
        version: 1,
      }),
    );

    const rows = unwrap(await listOrders(env.deps, t.m, { from: day, to: day, placedBy: t.joao.userId }));
    expect(rows.map((o) => [o.number, o.source, o.placedByName]).sort()).toEqual(
      [
        [j1.number, "STAFF", "João"],
        [j2.number, "STAFF", "João"],
        [j3.number, "STAFF", "João"],
      ].sort(),
    );
    expect(unwrap(await listOrders(env.deps, t.m, { from: day, to: day, placedBy: "QR" }))).toHaveLength(2);

    const summary = unwrap(await ordersBySource(env.deps, t.m, { from: day, to: day }));
    expect(summary.summary).toEqual([
      {
        source: "QR",
        placedById: null,
        name: null,
        count: 1,
        total: "9.00",
        cancelled: [{ reason: "CUSTOMER_GAVE_UP", count: 1 }],
      },
      {
        source: "STAFF",
        placedById: t.joao.userId,
        name: "João",
        count: 2,
        total: "86.00",
        cancelled: [{ reason: "ENTERED_BY_MISTAKE", count: 1 }],
      },
      { source: "STAFF", placedById: t.maria.userId, name: "Maria", count: 1, total: "9.00", cancelled: [] },
    ]);
    expect(summary.placedByOptions).toEqual([
      { value: "QR", label: "QR code" },
      { value: t.joao.userId, label: "João" },
      { value: t.maria.userId, label: "Maria" },
    ]);
    expect(code(await ordersBySource(env.deps, t.m, { from: day, to: "2026-12-31" }))).toBe("INVALID_PERIOD");
    // Endereço digitado à mão com lixo no filtro: lista vazia, sem erro do banco.
    expect(unwrap(await listOrders(env.deps, t.m, { from: day, to: day, placedBy: "lixo" }))).toEqual([]);
    expect(
      unwrap(await ordersBySource(env.deps, t.m, { from: day, to: day, placedBy: "lixo", tableId: "lixo" }))
        .summary,
    ).toEqual([]);

    const detail = unwrap(await getOrder(env.deps, t.m, j3.orderId));
    expect(detail).toMatchObject({ source: "STAFF", placedByName: "João" });
    expect(detail.events.map((e) => [e.toStatus, e.userName])).toEqual([
      ["RECEIVED", "João"],
      ["CANCELLED", "João"],
    ]);
  });
});

describe("cancelar o próprio pedido (spec 015, US4, FR-010)", () => {
  it("João cancela o que lançou, em Recebido, com Lançado errado; a cozinha não vê mais", async () => {
    const env = testEnv();
    const t = await staffScenario(env);
    const o = unwrap(await placeStaffOrder(env.deps, t.joao, t.input([t.juice()])));
    unwrap(
      await cancelOrder(env.deps, t.joao, {
        id: o.orderId,
        reason: "ENTERED_BY_MISTAKE",
        note: null,
        version: 1,
        ingredientsUsed: true,
      }),
    );
    const row = (await q("select status, cancel_reason from orders where id = $1", [o.orderId])).rows[0];
    expect(row).toEqual({ status: "CANCELLED", cancel_reason: "ENTERED_BY_MISTAKE" });
    expect(unwrap(await listKitchenOrders(env.deps, t.chef)).orders).toEqual([]);
  });

  it("pedido de outra pessoa ou do QR code: recusado e registrado", async () => {
    const env = testEnv();
    const t = await staffScenario(env);
    const maria = unwrap(await placeStaffOrder(env.deps, t.maria, t.input([t.juice()])));
    const qr = await t.s.place([t.s.juice()]);
    for (const id of [maria.orderId, qr.orderId])
      expect(
        code(
          await cancelOrder(env.deps, t.joao, { id, reason: "ENTERED_BY_MISTAKE", note: null, version: 1 }),
        ),
      ).toBe("FORBIDDEN");
    const denied = (
      await q(
        "select entity_id from audit_log where action = 'DENIED' and user_id = $1 order by occurred_at",
        [t.joao.userId],
      )
    ).rows.map((r) => r.entity_id);
    expect(denied).toEqual([maria.orderId, qr.orderId]);
    expect(
      code(
        await cancelOrder(env.deps, t.stockkeeper, {
          id: qr.orderId,
          reason: "OTHER",
          note: "x",
          version: 1,
        }),
      ),
    ).toBe("FORBIDDEN");
  });

  it("depois do Começar preparo: A cozinha já começou; o estoque baixa só uma vez", async () => {
    const env = testEnv();
    const t = await staffScenario(env);
    const o = unwrap(await placeStaffOrder(env.deps, t.joao, t.input([t.juice()])));
    await t.advance(o.orderId, "PREPARING");
    expect(
      code(
        await cancelOrder(env.deps, t.joao, {
          id: o.orderId,
          reason: "ENTERED_BY_MISTAKE",
          note: null,
          version: 2,
        }),
      ),
    ).toBe("KITCHEN_STARTED");
    // A tela ainda tinha a versão de antes do preparo: mesmo assim a resposta é a da cozinha.
    expect(
      code(
        await cancelOrder(env.deps, t.joao, {
          id: o.orderId,
          reason: "ENTERED_BY_MISTAKE",
          note: null,
          version: 1,
        }),
      ),
    ).toBe("KITCHEN_STARTED");
  });

  it("cancelar e Começar preparo ao mesmo tempo: só um vale e o estoque nunca baixa de cancelado", async () => {
    const env = testEnv();
    const t = await staffScenario(env);
    const o = unwrap(await placeStaffOrder(env.deps, t.joao, t.input([t.juice()])));
    const [cancel, start] = await Promise.all([
      cancelOrder(env.deps, t.joao, { id: o.orderId, reason: "ENTERED_BY_MISTAKE", note: null, version: 1 }),
      advanceOrderStatus(env.deps, t.chef, { id: o.orderId, to: "PREPARING", version: 1 }),
    ]);
    expect([cancel.ok, start.ok].filter(Boolean)).toHaveLength(1);
    const status = (await q("select status from orders where id = $1", [o.orderId])).rows[0].status;
    const sales = (
      await q("select count(*)::int as n from stock_movements where order_id = $1 and type = 'SALE_RECIPE'", [
        o.orderId,
      ])
    ).rows[0].n;
    expect(sales).toBe(status === "CANCELLED" ? 0 : 1);
    if (!cancel.ok) expect(["KITCHEN_STARTED", "STALE_RECORD"]).toContain(cancel.error.code);
  });
});

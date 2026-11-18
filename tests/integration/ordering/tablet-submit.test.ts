import { describe, expect, it } from "vitest";
import { ownerTestDb, testEnv } from "../harness";
import { code, tablet, unwrap } from "./fixtures";
import { billingScenario } from "../billing/fixtures";
import { submitOrder } from "../../../src/application/ordering/submit-order";
import { getMenu } from "../../../src/application/ordering/menu";
import { closeTab, getTab } from "../../../src/application/billing/tabs";
import { addPayment } from "../../../src/application/billing/payments";
import { listOrders, ordersBySource } from "../../../src/application/ordering/orders";
import { businessDay } from "../../../src/domain/ordering/business-day";

/** Pedido pelo tablet da mesa (spec 016, US4; FR-005, FR-008). */
const db = () => ownerTestDb().$client;

async function setup() {
  const env = testEnv();
  const b = await billingScenario(env);
  const cookie = await tablet(env, b.m, b.s.table.tableId);
  const send = (lines: unknown[], clientRequestId: string = crypto.randomUUID()) =>
    submitOrder(env.deps, { qr: null, tablet: cookie }, { clientRequestId, lines });
  const closeOpenTab = async () => {
    const id = await b.tabId();
    const tab = unwrap(await getTab(env.deps, b.cashier, id));
    for (const o of tab.orders) if (o.status !== "DELIVERED" && o.status !== "CANCELLED") await b.deliver(o.id);
    const due = unwrap(await getTab(env.deps, b.cashier, id));
    if (due.remaining.greaterThan(0))
      unwrap(
        await addPayment(env.deps, b.cashier, {
          tabId: id,
          method: "PIX",
          amount: due.remaining,
          received: null,
          clientRequestId: crypto.randomUUID(),
        }),
      );
    const version = unwrap(await getTab(env.deps, b.cashier, id)).version;
    return { id, closed: await closeTab(env.deps, b.cashier, { tabId: id, version }) };
  };
  return { env, b, cookie, send, closeOpenTab };
}

describe("pedido pelo tablet (spec 016, US4)", () => {
  it("grava a origem TABLET e entra na conta da Mesa 12", async () => {
    const { b, send } = await setup();
    const r = unwrap(await send([b.s.juice()]));
    const row = await db().query("select source, menu_access_id, tab_id from orders where id = $1", [r.orderId]);
    expect(row.rows[0].source).toBe("TABLET");
    expect(row.rows[0].menu_access_id).not.toBeNull();
    expect(row.rows[0].tab_id).toBe(await b.tabId());
  });

  it("11 pedidos seguidos passam; toque duplo devolve o mesmo pedido", async () => {
    const { b, send } = await setup();
    for (let i = 0; i < 11; i++) unwrap(await send([b.s.juice()]));
    const id = crypto.randomUUID();
    const [a, c] = await Promise.all([send([b.s.juice()], id), send([b.s.juice()], id)]);
    expect(unwrap(a).orderId).toBe(unwrap(c).orderId);
  });

  it("fechar a conta não encerra o tablet: o próximo pedido abre uma conta nova", async () => {
    const { env, b, cookie, send, closeOpenTab } = await setup();
    unwrap(await send([b.s.juice()]));
    const { id, closed } = await closeOpenTab();
    unwrap(closed);
    expect(code(await getMenu(env.deps, { qr: null, tablet: cookie }))).toBe("OK");
    const next = unwrap(await send([b.s.juice()]));
    const tab = (await db().query("select tab_id from orders where id = $1", [next.orderId])).rows[0].tab_id;
    expect(tab).not.toBe(id);
    expect(tab).toBe(await b.tabId());
  });

  it("3 horas depois o pedido ainda entra", async () => {
    const { env, b, send } = await setup();
    env.clock.advance(3 * 60 * 60 * 1000);
    expect(code(await send([b.s.juice()]))).toBe("OK");
  });

  it("pedido do tablet × fechar a conta (20 rodadas): nunca fica fora de conta", async () => {
    const { b, send, closeOpenTab } = await setup();
    for (let round = 0; round < 20; round++) {
      unwrap(await send([b.s.juice()]));
      const [sent] = await Promise.all([send([b.s.juice()]), closeOpenTab().catch(() => null)]);
      const order = unwrap(sent);
      const row = await db().query(
        "select o.tab_id, t.status, t.closed_at, o.submitted_at from orders o join table_tabs t on t.id = o.tab_id where o.id = $1",
        [order.orderId],
      );
      expect(row.rows).toHaveLength(1);
      // Caiu numa conta que fechou depois dele, ou numa conta aberta.
      const r = row.rows[0];
      if (r.status === "CLOSED") expect(new Date(r.closed_at).getTime()).toBeGreaterThanOrEqual(new Date(r.submitted_at).getTime());
      else expect(r.status).toBe("OPEN");
      // Fecha o que sobrou para a próxima rodada começar limpa.
      const open = await db().query("select id from table_tabs where table_id = $1 and status = 'OPEN'", [
        b.s.table.tableId,
      ]);
      if (open.rows[0]) unwrap((await closeOpenTab()).closed);
    }
  });

  it("consulta: filtro Origem 'Tablet' e o tablet no resumo, depois do QR code", async () => {
    const { env, b, send } = await setup();
    unwrap(await send([b.s.juice()]));
    await b.s.place([b.s.juice()]);
    const day = businessDay(env.clock.now(), "America/Sao_Paulo");
    const tabletOnly = unwrap(await listOrders(env.deps, b.m, { from: day, to: day, placedBy: "TABLET" }));
    expect(tabletOnly.map((o) => o.source)).toEqual(["TABLET"]);
    const qrOnly = unwrap(await listOrders(env.deps, b.m, { from: day, to: day, placedBy: "QR" }));
    expect(qrOnly.map((o) => o.source)).toEqual(["QR"]);
    const r = unwrap(await ordersBySource(env.deps, b.m, { from: day, to: day }));
    expect(r.placedByOptions.slice(0, 2)).toEqual([
      { value: "QR", label: "QR code" },
      { value: "TABLET", label: "Tablet da mesa" },
    ]);
    expect(r.summary.map((x) => x.source)).toEqual(["QR", "TABLET"]);
    const filtered = unwrap(await ordersBySource(env.deps, b.m, { from: day, to: day, placedBy: "TABLET" }));
    expect(filtered.summary.map((x) => [x.source, x.count])).toEqual([["TABLET", 1]]);
  });
});

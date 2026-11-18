import { describe, expect, it } from "vitest";
import { testEnv } from "../harness";
import { scan, tablet, unwrap } from "./fixtures";
import { billingScenario } from "../billing/fixtures";
import { listAccessOrders } from "../../../src/application/ordering/menu";
import { submitOrder } from "../../../src/application/ordering/submit-order";
import { closeTab, getTab } from "../../../src/application/billing/tabs";
import { addPayment } from "../../../src/application/billing/payments";

/** "Pedidos enviados" no tablet: os da conta aberta da mesa, de qualquer origem (spec 016, FR-007). */
describe("pedidos da conta aberta no tablet (spec 016, US5-4)", () => {
  it("tablet vê tablet, QR code; o celular continua vendo só os seus; conta fechada some", async () => {
    const env = testEnv();
    const b = await billingScenario(env);
    const tab = { qr: null, tablet: await tablet(env, b.m, b.s.table.tableId) };
    expect(unwrap(await listAccessOrders(env.deps, tab))).toEqual([]);

    const fromQr = await b.s.place([b.s.juice()]);
    const fromTablet = unwrap(
      await submitOrder(env.deps, tab, { clientRequestId: crypto.randomUUID(), lines: [b.s.juice(2)] }),
    );
    const otherPhone = await scan(env, b.s.table.token);
    expect(unwrap(await listAccessOrders(env.deps, tab)).map((o) => o.number)).toEqual([
      fromTablet.number,
      fromQr.number,
    ]);
    expect(unwrap(await listAccessOrders(env.deps, b.s.cookie)).map((o) => o.number)).toEqual([fromQr.number]);
    expect(unwrap(await listAccessOrders(env.deps, otherPhone))).toEqual([]);

    const id = await b.tabId();
    await b.deliver(fromQr.orderId);
    await b.deliver(fromTablet.orderId);
    const due = unwrap(await getTab(env.deps, b.cashier, id));
    unwrap(
      await addPayment(env.deps, b.cashier, {
        tabId: id,
        method: "PIX",
        amount: due.remaining,
        received: null,
        clientRequestId: crypto.randomUUID(),
      }),
    );
    unwrap(
      await closeTab(env.deps, b.cashier, {
        tabId: id,
        version: unwrap(await getTab(env.deps, b.cashier, id)).version,
      }),
    );
    expect(unwrap(await listAccessOrders(env.deps, tab))).toEqual([]);
  });
});

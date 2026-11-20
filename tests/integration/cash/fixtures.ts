import { addMember, newRestaurant, ownerTestDb, type TestEnv } from "../harness";
import { orderingKitchen, scan, tableWithQr, unwrap } from "../ordering/fixtures";
import { openingInput, OPENING_FLOAT, supplyInput, withdrawalInput } from "../../builders/cash-data";
import { createAddon } from "../../../src/application/ordering/addons";
import { setProductCustomization } from "../../../src/application/ordering/customization";
import { setRecipeSalePrice } from "../../../src/application/inventory/product-costs";
import { submitOrder } from "../../../src/application/ordering/submit-order";
import { advanceOrderStatus, markDelivered } from "../../../src/application/ordering/kitchen";
import { addPayment, removePayment } from "../../../src/application/billing/payments";
import { closeTab } from "../../../src/application/billing/tabs";
import { openCashSession } from "../../../src/application/cash/sessions";
import { addCashEntry } from "../../../src/application/cash/entries";
import { closeCashSession, countCash } from "../../../src/application/cash/closing";
import type { PaymentMethod } from "../../../src/domain/billing/payment";
import type { RequestContext } from "../../../src/application/context";
import { d } from "../../../src/domain/shared/decimal";

const db = () => ownerTestDb().$client;
export const money = (v: { toFixed(n: number): string } | null | undefined) => v?.toFixed(2) ?? null;

/**
 * Restaurante da spec 014: gerente, dois caixas (Ana e Bruno), garçom e chef; mesas 4 e 12;
 * X-Burger a R$ 30,00 com o adicional "Fatia de queijo" a R$ 2,00; Suco a R$ 9,00; sem taxa de
 * serviço, para os números redondos.
 */
export async function cashScenario(env: TestEnv, name = "Restaurante Sabor") {
  const m = await newRestaurant(env, name);
  await db().query("update restaurants set service_charge_rate = null where id = $1", [m.restaurantId]);
  const k = await orderingKitchen(env, m);
  const version = async () =>
    (await db().query("select version from recipes where id = $1", [k.burger])).rows[0].version as number;
  unwrap(await setRecipeSalePrice(env.deps, m, k.burger, await version(), d("30.00")));
  const cheese = unwrap(
    await createAddon(env.deps, m, {
      name: "Fatia de queijo",
      component: { kind: "ITEM", id: k.queijo },
      quantity: d("20"),
      unit: "g",
      price: d("2.00"),
    }),
  ).id;
  unwrap(
    await setProductCustomization(env.deps, m, {
      recipeId: k.burger,
      version: await version(),
      addons: [{ addonId: cheese, maxTimes: 2 }],
      removables: [],
    }),
  );
  const ana = await addMember(env, m, ["CASHIER"], "Ana");
  const bruno = await addMember(env, m, ["CASHIER"], "Bruno");
  const waiter = await addMember(env, m, ["WAITER"], "Garçom Beto");
  const chef = await addMember(env, m, ["CHEF"], "Chef Caio");

  const tables = new Map<string, { tableId: string; cookie: string }>();
  for (const tableName of ["4", "12"]) {
    const t = await tableWithQr(env, m, tableName);
    tables.set(tableName, { tableId: t.tableId, cookie: await scan(env, t.token) });
  }

  /** X-Burger, com `cheese` fatias de queijo a mais (R$ 2,00 cada). */
  const burger = (quantity = 1, cheeseTimes = 0) => ({
    recipeId: k.burger,
    quantity,
    unitPrice: d("30.00").plus(d(2).times(cheeseTimes)).toFixed(2),
    addons: cheeseTimes ? [{ addonId: cheese, times: cheeseTimes, unitPrice: "2.00" }] : [],
    removals: [],
  });
  const juice = (quantity = 1) => ({
    recipeId: k.suco,
    quantity,
    unitPrice: "9.00",
    addons: [],
    removals: [],
  });

  async function tabOf(tableName: string): Promise<string> {
    const r = await db().query("select id from table_tabs where table_id = $1 and status = 'OPEN'", [
      tables.get(tableName)!.tableId,
    ]);
    if (!r.rows[0]) throw new Error(`mesa ${tableName} sem conta aberta`);
    return r.rows[0].id as string;
  }
  /** Pedido na mesa; devolve o pedido e a conta aberta da mesa. */
  async function place(tableName: string, lines: unknown[]) {
    const order = unwrap(
      await submitOrder(env.deps, tables.get(tableName)!.cookie, {
        clientRequestId: crypto.randomUUID(),
        lines,
      }),
    );
    return { ...order, tabId: await tabOf(tableName) };
  }
  async function deliver(orderId: string) {
    for (const to of ["PREPARING", "READY", "DELIVERED"] as const) {
      const v = (await db().query("select version from orders where id = $1", [orderId])).rows[0]
        .version as number;
      if (to === "DELIVERED") unwrap(await markDelivered(env.deps, waiter, { id: orderId, version: v }));
      else unwrap(await advanceOrderStatus(env.deps, chef, { id: orderId, to, version: v }));
    }
  }
  /** Pedido já entregue (a conta pode fechar). */
  async function served(tableName: string, lines: unknown[]) {
    const order = await place(tableName, lines);
    await deliver(order.orderId);
    return order;
  }

  const openSession = async (amount = OPENING_FLOAT, by: RequestContext = ana, note: string | null = null) =>
    unwrap(await openCashSession(env.deps, by, openingInput(amount, note))).id;
  const pay = (
    tabId: string,
    method: PaymentMethod,
    amount: string,
    received: string | null = null,
    by: RequestContext = ana,
  ) =>
    addPayment(env.deps, by, {
      tabId,
      method,
      amount: d(amount),
      received: received === null ? null : d(received),
      clientRequestId: crypto.randomUUID(),
    });
  const unpay = (tabId: string, paymentId: string, by: RequestContext = ana) =>
    removePayment(env.deps, by, { tabId, paymentId });
  const closeTabOf = async (tabId: string, by: RequestContext = ana) => {
    const v = (await db().query("select version from table_tabs where id = $1", [tabId])).rows[0]
      .version as number;
    return closeTab(env.deps, by, { tabId, version: v });
  };
  const withdraw = (amount = "150.00", reason: unknown = "SAFE", note: string | null = null, by = ana) =>
    addCashEntry(env.deps, by, withdrawalInput(amount, reason, note));
  const supply = (amount = "50.00", note: string | null = null, by = ana) =>
    addCashEntry(env.deps, by, supplyInput(amount, note));
  const count = (sessionId: string, counted: string, by: RequestContext = ana) =>
    countCash(env.deps, by, { sessionId, counted: d(counted), denominations: null });
  /** Conta e fecha de uma vez. */
  const closeSession = async (
    sessionId: string,
    counted: string,
    opts: { kept?: string; note?: string; by?: RequestContext } = {},
  ) => {
    const by = opts.by ?? ana;
    unwrap(await count(sessionId, counted, by));
    return closeCashSession(env.deps, by, {
      sessionId,
      kept: opts.kept === undefined ? null : d(opts.kept),
      note: opts.note ?? null,
    });
  };
  const sessionRow = async (id: string) =>
    (await db().query("select s.*, s.business_day::text as day from cash_sessions s where s.id = $1", [id]))
      .rows[0] as Record<string, unknown>;

  /**
   * O turno da spec (US2 a US5): troco R$ 150,00; mesa 12 paga R$ 77,00 em dinheiro (recebido
   * R$ 100,00) e R$ 40,00 em Pix; sangria de R$ 150,00 (Cofre) e reforço de R$ 50,00. Esperado:
   * R$ 127,00.
   */
  async function specShift() {
    const sessionId = await openSession();
    // 3 X-Burger (R$ 90,00) + 3 Sucos (R$ 27,00) = R$ 117,00
    const order = await served("12", [burger(3), juice(3)]);
    const cash = unwrap(await pay(order.tabId, "CASH", "77.00", "100.00"));
    const pix = unwrap(await pay(order.tabId, "PIX", "40.00"));
    const withdrawal = unwrap(await withdraw("150.00", "SAFE"));
    const supplied = unwrap(await supply("50.00", "Troco do cofre"));
    return { sessionId, tabId: order.tabId, orderId: order.orderId, cash, pix, withdrawal, supplied };
  }

  return {
    m,
    ana,
    bruno,
    waiter,
    chef,
    k,
    cheese,
    tables,
    burger,
    juice,
    tabOf,
    place,
    deliver,
    served,
    openSession,
    pay,
    unpay,
    closeTabOf,
    withdraw,
    supply,
    count,
    closeSession,
    sessionRow,
    specShift,
  };
}

export type CashScenario = Awaited<ReturnType<typeof cashScenario>>;

/** Abre o caixa do restaurante (para os testes de outras features que lançam pagamento). */
export async function openCash(env: TestEnv, by: RequestContext, amount = "0.00"): Promise<string> {
  return unwrap(await openCashSession(env.deps, by, openingInput(amount))).id;
}

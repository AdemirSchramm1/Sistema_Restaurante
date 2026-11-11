import { addMember, newRestaurant, ownerTestDb, type TestEnv } from "../harness";
import { orderingScenario, unwrap } from "../ordering/fixtures";
import { advanceOrderStatus, markDelivered } from "../../../src/application/ordering/kitchen";

/**
 * Mesa 12 da spec 011: X-Burger (+ Fatia de queijo, "Sem cebola") e Suco; gerente, chef, garçom e
 * caixa. `deliver` leva o pedido da cozinha à mesa; `tabId` acha a conta aberta da mesa.
 */
export async function billingScenario(env: TestEnv) {
  const m = await newRestaurant(env, "Restaurante Sabor");
  const s = await orderingScenario(env, m);
  const chef = await addMember(env, m, ["CHEF"], "Chef Ana");
  const waiter = await addMember(env, m, ["WAITER"], "Garçom Beto");
  const cashier = await addMember(env, m, ["CASHIER"], "Caixa Carla");
  const stockkeeper = await addMember(env, m, ["STOCKKEEPER"], "Estoquista Dani");

  async function advance(orderId: string, to: "PREPARING" | "READY" | "DELIVERED") {
    const v = (await ownerTestDb().$client.query("select version from orders where id = $1", [orderId])).rows[0]
      .version as number;
    if (to === "DELIVERED") unwrap(await markDelivered(env.deps, waiter, { id: orderId, version: v }));
    else unwrap(await advanceOrderStatus(env.deps, chef, { id: orderId, to, version: v }));
  }
  async function deliver(orderId: string) {
    await advance(orderId, "PREPARING");
    await advance(orderId, "READY");
    await advance(orderId, "DELIVERED");
  }
  async function tabId(tableId = s.table.tableId): Promise<string> {
    const r = await ownerTestDb().$client.query(
      "select id from table_tabs where table_id = $1 and status = 'OPEN'",
      [tableId],
    );
    if (!r.rows[0]) throw new Error("mesa sem conta aberta");
    return r.rows[0].id as string;
  }
  return { m, s, chef, waiter, cashier, stockkeeper, advance, deliver, tabId };
}

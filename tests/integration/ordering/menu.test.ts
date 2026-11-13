import { describe, it, expect } from "vitest";
import { newRestaurant, ownerTestDb, testEnv } from "../harness";
import { code, orderingKitchen, scan, tableWithQr, unwrap } from "./fixtures";
import { getMenu, listAccessOrders } from "../../../src/application/ordering/menu";
import { submitOrder } from "../../../src/application/ordering/submit-order";
import { createAddon } from "../../../src/application/ordering/addons";
import { setProductCustomization } from "../../../src/application/ordering/customization";
import { d } from "../../../src/domain/shared/decimal";

describe("cardápio do celular (spec 009 US2 + spec 010 US3)", () => {
  it("mostra só produtos vendidos, ativos, com preço e não esgotados hoje, com os botões da 010", async () => {
    const env = testEnv();
    const m = await newRestaurant(env, "Cantina da Nona");
    const k = await orderingKitchen(env, m);
    const cheese = unwrap(
      await createAddon(env.deps, m, {
        name: "Fatia de queijo",
        component: { kind: "ITEM", id: k.queijo },
        quantity: d("20"),
        unit: "g",
        price: d("3.00"),
      }),
    ).id;
    unwrap(
      await setProductCustomization(env.deps, m, {
        recipeId: k.burger,
        version: 2,
        addons: [{ addonId: cheese, maxTimes: 2 }],
        removables: [{ component: { kind: "ITEM", id: k.cebola } }],
      }),
    );
    const { token } = await tableWithQr(env, m, "5");
    const cookie = await scan(env, token);

    const menu = unwrap(await getMenu(env.deps, cookie));
    expect(menu).toMatchObject({ restaurantName: "Cantina da Nona", tableName: "5", ordersLeft: 10 });
    // Spec 013, US3.5: a ordem é a do cardápio (aqui, a de criação: X-Burger, depois Suco), não a alfabética.
    expect(menu.products).toEqual([
      {
        id: k.burger,
        name: "X-Burger",
        price: "28.00",
        addons: [{ id: cheese, name: "Fatia de queijo", price: "3.00", maxTimes: 2 }],
        removables: [{ kind: "ITEM", id: k.cebola, label: "Sem cebola" }],
      },
      { id: k.suco, name: "Suco", price: "9.00", addons: [], removables: [] },
    ]);

    await ownerTestDb().$client.query("update recipes set sold_out_on = '2026-10-31' where id = $1", [
      k.suco,
    ]);
    expect(unwrap(await getMenu(env.deps, cookie)).products.map((p) => p.name)).toEqual(["X-Burger"]);
    await ownerTestDb().$client.query("update recipes set sold_out_on = '2026-10-30' where id = $1", [
      k.suco,
    ]);
    expect(unwrap(await getMenu(env.deps, cookie)).products.map((p) => p.name)).toEqual(["X-Burger", "Suco"]);
  });

  it("'Meus pedidos' mostra só os pedidos deste celular, mais novo primeiro", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const k = await orderingKitchen(env, m);
    const { token } = await tableWithQr(env, m, "5");
    const mine = await scan(env, token);
    const other = await scan(env, token);
    const juice = { recipeId: k.suco, quantity: 1, unitPrice: "9.00", addons: [], removals: [] };
    unwrap(await submitOrder(env.deps, mine, { clientRequestId: crypto.randomUUID(), lines: [juice] }));
    env.clock.advance(60_000);
    unwrap(
      await submitOrder(env.deps, mine, {
        clientRequestId: crypto.randomUUID(),
        lines: [{ ...juice, quantity: 2 }],
      }),
    );
    unwrap(await submitOrder(env.deps, other, { clientRequestId: crypto.randomUUID(), lines: [juice] }));

    const list = unwrap(await listAccessOrders(env.deps, mine));
    expect(list.map((o) => [o.number, o.status, o.total])).toEqual([
      [2, "RECEIVED", "18.00"],
      [1, "RECEIVED", "9.00"],
    ]);
    expect(unwrap(await getMenu(env.deps, mine)).ordersLeft).toBe(8);
    expect(code(await listAccessOrders(env.deps, "outro"))).toBe("ACCESS_EXPIRED");
  });
});

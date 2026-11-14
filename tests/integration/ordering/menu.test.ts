import { describe, it, expect } from "vitest";
import { newRestaurant, ownerTestDb, testEnv } from "../harness";
import { code, orderingKitchen, scan, tableWithQr, unwrap } from "./fixtures";
import { getMenu, listAccessOrders } from "../../../src/application/ordering/menu";
import { submitOrder } from "../../../src/application/ordering/submit-order";
import { createAddon } from "../../../src/application/ordering/addons";
import { setProductCustomization } from "../../../src/application/ordering/customization";
import { d } from "../../../src/domain/shared/decimal";
import { readFile } from "node:fs/promises";
import { countingEnv } from "../performance/counting";
import { addSection, menuScenario } from "../menu/fixtures";
import { itemLine } from "../../builders/recipe-data";
import { createMenuProduct } from "../../../src/application/menu/create-product";
import { setMenuDetails } from "../../../src/application/menu/details";
import { setProductPhoto } from "../../../src/application/menu/photo";
import type { MenuView } from "../../../src/application/ordering/menu";

/** Idas ao banco do `getMenu` antes da spec 013 (medido na 012). */
const QUERIES_BEFORE = 14;
const names = (menu: MenuView) => menu.sections.flatMap((s) => s.products.map((p) => p.name));

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
    // Spec 013, US2.4: sem nenhuma seção, o cardápio vem num grupo só e sem títulos.
    expect(menu.showSectionTitles).toBe(false);
    expect(menu.sections).toEqual([
      {
        id: null,
        name: "Outros",
        products: [
          {
            id: k.burger,
            name: "X-Burger",
            price: "28.00",
            description: null,
            photo: null,
            addons: [{ id: cheese, name: "Fatia de queijo", price: "3.00", maxTimes: 2 }],
            removables: [{ kind: "ITEM", id: k.cebola, label: "Sem cebola" }],
          },
          {
            id: k.suco,
            name: "Suco",
            price: "9.00",
            description: null,
            photo: null,
            addons: [],
            removables: [],
          },
        ],
      },
    ]);
    expect(menu).not.toHaveProperty("products");

    await ownerTestDb().$client.query("update recipes set sold_out_on = '2026-10-31' where id = $1", [
      k.suco,
    ]);
    expect(names(unwrap(await getMenu(env.deps, cookie)))).toEqual(["X-Burger"]);
    await ownerTestDb().$client.query("update recipes set sold_out_on = '2026-10-30' where id = $1", [
      k.suco,
    ]);
    expect(names(unwrap(await getMenu(env.deps, cookie)))).toEqual(["X-Burger", "Suco"]);
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

  it("vem por seção, na ordem escolhida, com descrição e foto (spec 013, US6)", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const { photo } = unwrap(
      await setProductPhoto(env.deps, s.m, {
        id: s.burger,
        bytes: new Uint8Array(await readFile("tests/screens/photos/prato.png")),
      }),
    );
    unwrap(
      await setMenuDetails(env.deps, s.m, {
        id: s.burger,
        version: 2,
        description: "Pão, carne e queijo.\nFeito na hora.",
        sectionId: s.lanches,
      }),
    );
    const { token } = await tableWithQr(env, s.m, "7");
    const menu = unwrap(await getMenu(env.deps, await scan(env, token)));
    expect(menu.showSectionTitles).toBe(true);
    // Entradas está vazia e a Batata frita (em Outros) não tem preço: nenhuma das duas aparece.
    expect(menu.sections.map((x) => [x.id, x.name, x.products.map((p) => p.name)])).toEqual([
      [s.lanches, "Lanches", ["X-Burger", "X-Salada"]],
      [s.bebidas, "Bebidas", ["Suco", "Água"]],
    ]);
    expect(menu.sections[0]!.products[0]).toMatchObject({
      description: "Pão, carne e queijo.\nFeito na hora.",
      photo: { base: photo.base, widths: [300, 600] },
    });
    expect(menu.sections[0]!.products[1]).toMatchObject({ description: null, photo: null });
  });

  it("produto com seção e produto sem seção: os títulos aparecem e Outros vem no fim", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    unwrap(await setMenuDetails(env.deps, s.m, { id: s.agua, version: 2, description: "", sectionId: null }));
    const { token } = await tableWithQr(env, s.m, "7");
    const menu = unwrap(await getMenu(env.deps, await scan(env, token)));
    expect(menu.showSectionTitles).toBe(true);
    expect(menu.sections.map((x) => [x.name, x.products.map((p) => p.name)])).toEqual([
      ["Lanches", ["X-Burger", "X-Salada"]],
      ["Bebidas", ["Suco"]],
      ["Outros", ["Água"]],
    ]);
  });

  it("nada de outro restaurante entra no cardápio", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const other = await menuScenario(env);
    await addSection(env, other.m, "Só do vizinho");
    const { token } = await tableWithQr(env, s.m, "7");
    const menu = unwrap(await getMenu(env.deps, await scan(env, token)));
    const ids = menu.sections.flatMap((x) => [x.id, ...x.products.map((p) => p.id)]);
    expect(ids).toEqual([s.lanches, s.burger, s.salada, s.bebidas, s.suco, s.agua]);
    expect(ids).not.toContain(other.burger);
  });

  it("uma consulta a mais que antes das seções, e o mesmo número com 4 ou 40 produtos", async () => {
    const env = testEnv();
    const counting = countingEnv(env);
    const s = await menuScenario(env);
    const { token } = await tableWithQr(env, s.m, "7");
    const cookie = await scan(env, token);
    const measure = async () => {
      counting.take();
      const menu = unwrap(await getMenu(counting.deps, cookie));
      return { queries: counting.take(), products: names(menu).length };
    };
    const few = await measure();
    for (let n = 1; n <= 36; n++)
      unwrap(
        await createMenuProduct(env.deps, s.m, {
          name: `Prato ${n}`,
          lines: [itemLine(s.pao, "1", "un")],
          salePrice: d("10.00"),
          sectionId: n % 2 ? s.lanches : null,
          description: "",
        }),
      );
    const many = await measure();
    await counting.close();
    expect([few.products, many.products]).toEqual([4, 40]);
    expect(many.queries).toBe(few.queries);
    // Antes da spec 013 eram QUERIES_BEFORE idas ao banco; as seções custam uma a mais.
    expect(few.queries).toBe(QUERIES_BEFORE + 1);
  });
});

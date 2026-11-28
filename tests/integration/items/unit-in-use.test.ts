import { describe, it, expect } from "vitest";
import { newRestaurant, subgroupId, testEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { itemLine } from "../../builders/recipe-data";
import { orderingKitchen, unwrap } from "../ordering/fixtures";
import { createItem } from "../../../src/application/inventory/create-item";
import { updateItem } from "../../../src/application/inventory/update-item";
import { createRecipe, updateRecipe } from "../../../src/application/inventory/recipes";
import { createAddon } from "../../../src/application/ordering/addons";
import { d } from "../../../src/domain/shared/decimal";
import type { Result } from "../../../src/domain/shared/result";

/**
 * docs/produto/estoque/02 (decisão do Ademir, 2026-11-28): item que um produto ou adicional usa não
 * troca de família de medida (kg ↔ un ↔ l). Sem isso, a quantidade da linha (150 g) não converte e o
 * "Começar preparo" de todo pedido daquele produto falha.
 */

const fail = (r: Result<unknown>) => (r.ok ? "OK" : [r.error.code, r.error.field, r.error.details?.usedBy]);

describe("medida de item usado em produto (spec 018, decisão de 2026-11-28)", () => {
  it("item num produto não vira un nem l; a recusa diz em quais produtos ele está", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const k = await orderingKitchen(env, m);
    const sub = await subgroupId(env, m, "01", "02");
    const carne = {
      subgroupId: sub,
      description: "Carne moída",
      purchaseUnitLabel: null,
      purchaseFactor: null,
    };
    expect(fail(await updateItem(env.deps, m, k.carne, 1, itemData({ ...carne, stockUnit: "un" })))).toEqual([
      "ITEM_UNIT_IN_USE",
      "stockUnit",
      ["X-Burger"],
    ]);
    // Na mesma família a linha ainda converte: kg para g pode.
    expect(fail(await updateItem(env.deps, m, k.carne, 1, itemData({ ...carne, stockUnit: "g" })))).toBe(
      "OK",
    );
  });

  it("vale para item dentro de preparo e para item de adicional", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const k = await orderingKitchen(env, m);
    const sub = await subgroupId(env, m, "01", "02");
    const bacon = { subgroupId: sub, description: "Bacon", purchaseUnitLabel: null, purchaseFactor: null };
    expect(fail(await updateItem(env.deps, m, k.bacon, 1, itemData({ ...bacon, stockUnit: "un" })))).toEqual([
      "ITEM_UNIT_IN_USE",
      "stockUnit",
      ["Molho da casa"],
    ]);

    const azeitona = unwrap(
      await createItem(env.deps, m, itemData({ subgroupId: sub, description: "Azeitona", stockUnit: "kg" })),
    ).id;
    unwrap(
      await createAddon(env.deps, m, {
        name: "Azeitonas",
        component: { kind: "ITEM", id: azeitona },
        quantity: d("15"),
        unit: "g",
        price: d("2.00"),
      }),
    );
    expect(
      fail(
        await updateItem(
          env.deps,
          m,
          azeitona,
          1,
          itemData({ subgroupId: sub, description: "Azeitona", stockUnit: "un" }),
        ),
      ),
    ).toEqual(["ITEM_UNIT_IN_USE", "stockUnit", ["Azeitonas"]]);
  });

  it("produto que tirou o item numa versão nova ainda segura a troca: pedidos antigos usam a versão velha", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const sub = await subgroupId(env, m, "01", "02");
    const make = async (description: string) =>
      unwrap(await createItem(env.deps, m, itemData({ subgroupId: sub, description, stockUnit: "kg" }))).id;
    const arroz = await make("Arroz");
    const feijao = await make("Feijão");
    const prato = unwrap(
      await createRecipe(env.deps, m, {
        name: "Prato feito",
        kind: "DISH",
        yieldQuantity: null,
        yieldUnit: null,
        lines: [itemLine(arroz, "150", "g"), itemLine(feijao, "100", "g")],
      }),
    ).id;
    unwrap(
      await updateRecipe(env.deps, m, prato, 1, {
        name: "Prato feito",
        kind: "DISH",
        yieldQuantity: null,
        yieldUnit: null,
        lines: [itemLine(arroz, "150", "g")],
      }),
    );
    expect(
      fail(
        await updateItem(
          env.deps,
          m,
          feijao,
          1,
          itemData({ subgroupId: sub, description: "Feijão", stockUnit: "un" }),
        ),
      ),
    ).toEqual(["ITEM_UNIT_IN_USE", "stockUnit", ["Prato feito"]]);
  });

  it("item que nenhum produto nem adicional usa troca de família à vontade", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const sub = await subgroupId(env, m, "01", "02");
    const id = unwrap(
      await createItem(
        env.deps,
        m,
        itemData({ subgroupId: sub, description: "Guardanapo", stockUnit: "kg" }),
      ),
    ).id;
    expect(
      fail(
        await updateItem(
          env.deps,
          m,
          id,
          1,
          itemData({ subgroupId: sub, description: "Guardanapo", stockUnit: "un" }),
        ),
      ),
    ).toBe("OK");
  });
});

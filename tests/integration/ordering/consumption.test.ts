import { describe, it, expect } from "vitest";
import { newRestaurant, testEnv } from "../harness";
import { code, orderingScenario, unwrap } from "./fixtures";
import { orderConsumption } from "../../../src/application/ordering/order-consumption";
import { updateRecipe } from "../../../src/application/inventory/recipes";
import { itemLine } from "../../builders/recipe-data";

describe("consumo do pedido para a baixa (spec 010, US5)", () => {
  it("2 × X-Burger + 2 Fatia de queijo, sem cebola: pão 2, carne 0,3 kg, queijo 0,14 kg, nada de cebola", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    const { orderId } = await s.place([s.burger(2)]);

    // Versão nova do X-Burger depois do envio: o consumo segue a versão gravada no pedido.
    unwrap(
      await updateRecipe(env.deps, m, s.burgerId, 3, {
        name: "X-Burger",
        kind: "DISH",
        yieldQuantity: null,
        yieldUnit: null,
        lines: [itemLine(s.pao, "1", "un"), itemLine(s.carne, "200", "g"), itemLine(s.queijo, "30", "g"), itemLine(s.cebola, "20", "g")],
      }),
    );

    const used = unwrap(await orderConsumption(env.deps, m.restaurantId, orderId));
    const view = Object.fromEntries([...used].map(([id, q]) => [id, q.toString()]));
    expect(view).toEqual({ [s.pao]: "2", [s.carne]: "0.3", [s.queijo]: "0.14" });
  });

  it("pedido de outro restaurante não existe aqui", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const other = await newRestaurant(env, "Outro");
    const s = await orderingScenario(env, m);
    const { orderId } = await s.place([s.juice()]);
    expect(code(await orderConsumption(env.deps, other.restaurantId, orderId))).toBe("NOT_FOUND");
  });
});

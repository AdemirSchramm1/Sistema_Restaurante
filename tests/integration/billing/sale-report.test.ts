import { describe, it, expect } from "vitest";
import { addMember, newRestaurant, testEnv } from "../harness";
import { orderingScenario, unwrap } from "../ordering/fixtures";
import { advanceOrderStatus } from "../../../src/application/ordering/kitchen";
import { registerLoss, registerPurchase } from "../../../src/application/inventory/movements";
import { stockReport } from "../../../src/application/inventory/stock-report";
import { reasonByCode } from "../../../src/domain/inventory/movement-reasons";
import { d } from "../../../src/domain/shared/decimal";

/** Spec 011, US4 cenário 7: os gráficos da 006 contam as vendas, separadas das perdas. */

describe("gráficos do estoque com as vendas (spec 011, US4)", () => {
  it("'Venda' aparece nas saídas por motivo, separada das famílias de perda", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    const chef = await addMember(env, m, ["CHEF"], "Chef Ana");
    unwrap(
      await registerPurchase(env.deps, m, {
        itemId: s.queijo,
        quantity: d("1"),
        unit: "kg",
        totalPaid: d("50.00"),
        occurredAt: env.clock.now(),
        notes: null,
        idempotencyKey: null,
      }),
    );
    unwrap(
      await registerLoss(env.deps, m, {
        itemId: s.queijo,
        quantity: d("0.1"),
        unit: "kg",
        reasonId: reasonByCode("LOSS", "BURNT")!.id,
        occurredAt: env.clock.now(),
        notes: null,
        idempotencyKey: null,
      }),
    );
    const { orderId } = await s.place([s.burger(2)]);
    unwrap(await advanceOrderStatus(env.deps, chef, { id: orderId, to: "PREPARING", version: 1 }));

    const r = unwrap(await stockReport(env.deps, m, "7"));
    expect(r.byReason.map((x) => [x.label, x.value.toString()])).toEqual([
      ["Venda", "21"],
      ["Queimou", "5"],
    ]);
    expect(r.summary.losses.toString()).toBe("5");
    expect(r.summary.outflow.toString()).toBe("26");
    expect(r.most.map((x) => x.name)).toEqual(expect.arrayContaining(["Carne moída", "Queijo prato"]));
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newRestaurant, testEnv, type TestEnv } from "../harness";
import { orderingScenario, unwrap } from "../ordering/fixtures";
import { countingEnv } from "./counting";
import { submitOrder } from "../../../src/application/ordering/submit-order";

/**
 * Spec 012, US4 cenário 5 e R6: o "Confirmar" do cliente não faz uma ida ao banco por linha do
 * pedido. Linhas, adicionais e retiradas são gravados em lote.
 */
describe("envio do pedido em lote (spec 012, FR-009)", () => {
  let env: TestEnv;
  let counting: ReturnType<typeof countingEnv>;

  beforeEach(() => {
    env = testEnv();
    counting = countingEnv(env);
  });
  afterEach(async () => {
    await counting.close();
  });

  it("pedido de 1 linha e de 3 linhas (com adicionais e retiradas) fazem o mesmo número de consultas", async () => {
    const m = await newRestaurant(env);
    const s = await orderingScenario(env, m);
    await s.place([s.juice()]); // abre a conta da mesa: os dois envios medidos acham a conta aberta
    const send = async (lines: unknown[]) => {
      counting.take();
      unwrap(await submitOrder(counting.deps, s.cookie, { clientRequestId: crypto.randomUUID(), lines }));
      return counting.take();
    };

    const one = await send([s.burger()]);
    const three = await send([s.burger(), s.burger(2), s.juice(3)]);

    expect(one).toBeGreaterThan(0);
    expect(three).toBe(one);
  });
});

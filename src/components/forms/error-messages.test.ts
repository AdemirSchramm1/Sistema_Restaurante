import { describe, it, expect } from "vitest";
import { messageFor } from "./error-messages";

describe("mensagens com valores da conta da mesa (spec 011)", () => {
  it("tirar a taxa com o pago acima do novo total diz os valores e o que fazer", () => {
    expect(
      messageFor({ code: "PAYMENT_EXCEEDS_REMAINING", details: { total: "77.00", paid: "80.00" } }),
    ).toBe("Já foram pagos R$ 80,00 e, sem a taxa, a conta fica em R$ 77,00. Tire um pagamento antes de tirar a taxa.");
  });
});

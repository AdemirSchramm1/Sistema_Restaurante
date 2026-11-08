import { describe, it, expect } from "vitest";
import { MAX_ORDERS_PER_ACCESS, checkOrderShape, orderTotal, validateLineQuantity } from "./order-lines";
import { d } from "../shared/decimal";

describe("linhas do pedido (spec 009, casos-limite)", () => {
  it("quantidade inteira de 1 a 20", () => {
    for (const q of [1, 20]) expect(validateLineQuantity(q).ok, String(q)).toBe(true);
    for (const q of [0, 21, -1, 1.5, Number.NaN]) {
      const r = validateLineQuantity(q);
      expect(!r.ok && r.error.code, String(q)).toBe("INVALID_QUANTITY");
    }
  });

  it("pedido tem de 1 a 30 linhas", () => {
    expect(!checkOrderShape(0, 0).ok && (checkOrderShape(0, 0) as { error: { code: string } }).error.code).toBe(
      "EMPTY_ORDER",
    );
    const many = checkOrderShape(31, 0);
    expect(!many.ok && many.error.code).toBe("TOO_MANY_LINES");
    expect(checkOrderShape(30, 0).ok).toBe(true);
  });

  it("até 10 pedidos por acesso; o seguinte pede para chamar o garçom", () => {
    expect(MAX_ORDERS_PER_ACCESS).toBe(10);
    expect(checkOrderShape(1, 9).ok).toBe(true);
    const r = checkOrderShape(1, 10);
    expect(!r.ok && r.error.code).toBe("ACCESS_ORDER_LIMIT");
  });

  it("total = soma de preço × quantidade, exato (2 × 28,00 + 1 × 9,00 = 65,00)", () => {
    const total = orderTotal([
      { unitPrice: d("28.00"), quantity: 2 },
      { unitPrice: d("9.00"), quantity: 1 },
    ]);
    expect(total.toFixed(2)).toBe("65.00");
    expect(orderTotal([{ unitPrice: d("0.1"), quantity: 3 }]).toString()).toBe("0.3");
  });
});

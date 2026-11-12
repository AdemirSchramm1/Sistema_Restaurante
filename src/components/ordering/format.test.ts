import { describe, it, expect } from "vitest";
import { d } from "@/domain/shared/decimal";
import { brl, priceOrFree } from "./format";

describe("dinheiro nas telas de pedido", () => {
  it("aceita o texto do servidor ou o decimal", () => {
    expect(brl("28.5")).toBe("R$ 28,50");
    expect(brl(d("1234.5"))).toBe("R$ 1.234,50");
  });

  it("adicional de preço zero aparece como grátis", () => {
    expect(priceOrFree("0.00")).toBe("Grátis");
    expect(priceOrFree(d(0))).toBe("Grátis");
    expect(priceOrFree("3.00")).toBe("R$ 3,00");
  });
});

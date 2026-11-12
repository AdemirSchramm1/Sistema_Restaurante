import { describe, it, expect } from "vitest";
import { parseOrderInput } from "./order-input";

const ID = "0193a000-0000-7000-8000-000000000001";
const RECIPE = "0193a000-0000-7000-8000-000000000002";
const ADDON = "0193a000-0000-7000-8000-000000000003";
const ITEM = "0193a000-0000-7000-8000-000000000004";

const line = (over: Record<string, unknown> = {}) => ({
  recipeId: RECIPE,
  quantity: 2,
  unitPrice: "34.00",
  addons: [{ addonId: ADDON, times: 2, unitPrice: "3.00" }],
  removals: [{ kind: "ITEM", id: ITEM }],
  ...over,
});
const code = (raw: unknown) => {
  const r = parseOrderInput(raw);
  return r.ok ? "OK" : r.error.code;
};

describe("entrada do envio do pedido (spec 009, spec 010)", () => {
  it("o que o carrinho manda vira linhas com preço em decimal exato", () => {
    const r = parseOrderInput({ clientRequestId: ID, lines: [line()] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [l] = r.value.lines;
    expect(r.value.clientRequestId).toBe(ID);
    expect(l!.unitPrice.toFixed(2)).toBe("34.00");
    expect(l!.addons.map((a) => [a.addonId, a.times, a.unitPrice.toFixed(2)])).toEqual([[ADDON, 2, "3.00"]]);
    expect(l!.removals).toEqual([{ kind: "ITEM", id: ITEM }]);
  });

  it("campo a mais é recusado, como uma observação livre", () => {
    expect(code({ clientRequestId: ID, lines: [line({ note: "sem sal" })] })).toBe("VALIDATION");
    expect(code({ clientRequestId: ID, lines: [line()], table: "4" })).toBe("VALIDATION");
  });

  it("preço só em texto com ponto e até 2 casas", () => {
    for (const unitPrice of ["34,00", "34.001", 34, "-1.00", ""])
      expect(code({ clientRequestId: ID, lines: [line({ unitPrice })] })).toBe("VALIDATION");
  });

  it("ids malformados e retiradas de outro tipo são recusados", () => {
    expect(code({ clientRequestId: "abc", lines: [line()] })).toBe("VALIDATION");
    expect(code({ clientRequestId: ID, lines: [line({ recipeId: "x" })] })).toBe("VALIDATION");
    expect(code({ clientRequestId: ID, lines: [line({ removals: [{ kind: "ADDON", id: ITEM }] })] })).toBe(
      "VALIDATION",
    );
  });

  it("limites de tamanho: até 100 linhas e 20 adicionais por linha", () => {
    expect(code({ clientRequestId: ID, lines: Array.from({ length: 100 }, () => line()) })).toBe("OK");
    expect(code({ clientRequestId: ID, lines: Array.from({ length: 101 }, () => line()) })).toBe(
      "VALIDATION",
    );
    const addons = Array.from({ length: 21 }, () => ({ addonId: ADDON, times: 1, unitPrice: "1.00" }));
    expect(code({ clientRequestId: ID, lines: [line({ addons })] })).toBe("VALIDATION");
  });

  it("o que não é objeto é recusado sem quebrar", () => {
    for (const raw of [null, "pedido", [], 7]) expect(code(raw)).toBe("VALIDATION");
  });
});

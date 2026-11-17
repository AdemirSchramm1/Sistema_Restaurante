import { describe, it, expect } from "vitest";
import { parseStaffOrderInput } from "./staff-order-input";

const ID = "0193a000-0000-7000-8000-000000000001";
const TABLE = "0193a000-0000-7000-8000-000000000005";
const TAB = "0193a000-0000-7000-8000-000000000006";
const RECIPE = "0193a000-0000-7000-8000-000000000002";
const ADDON = "0193a000-0000-7000-8000-000000000003";
const ITEM = "0193a000-0000-7000-8000-000000000004";

const line = (over: Record<string, unknown> = {}) => ({
  recipeId: RECIPE,
  quantity: 2,
  unitPrice: "34.00",
  addons: [{ addonId: ADDON, times: 2, unitPrice: "3.00" }],
  removals: [{ kind: "ITEM", id: ITEM }],
  kitchenNote: "mal passado",
  ...over,
});
const input = (over: Record<string, unknown> = {}) => ({
  tableId: TABLE,
  clientRequestId: ID,
  tabIdSeen: TAB,
  lines: [line()],
  ...over,
});
const code = (raw: unknown) => {
  const r = parseStaffOrderInput(raw);
  return r.ok ? "OK" : r.error.code;
};

describe("entrada do pedido da equipe (spec 015, contracts/use-cases.md)", () => {
  it("mesa, envio, conta vista e linhas com a observação; preço em decimal exato", () => {
    const r = parseStaffOrderInput(input());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ tableId: TABLE, clientRequestId: ID, tabIdSeen: TAB });
    const [l] = r.value.lines;
    expect(l!.kitchenNote).toBe("mal passado");
    expect(l!.unitPrice.toFixed(2)).toBe("34.00");
    expect(l!.addons.map((a) => [a.addonId, a.times, a.unitPrice.toFixed(2)])).toEqual([[ADDON, 2, "3.00"]]);
    expect(l!.removals).toEqual([{ kind: "ITEM", id: ITEM }]);
  });

  it("sem conta vista e sem observação também vale", () => {
    const r = parseStaffOrderInput(input({ tabIdSeen: null, lines: [line({ kitchenNote: null })] }));
    expect(r.ok && r.value.tabIdSeen).toBe(null);
    expect(r.ok && r.value.lines[0]!.kitchenNote).toBe(null);
  });

  it("campo a mais, id inválido, preço com 3 casas ou observação que não é texto: VALIDATION", () => {
    expect(code(input({ restaurantId: TABLE }))).toBe("VALIDATION");
    expect(code(input({ tableId: "12" }))).toBe("VALIDATION");
    expect(code(input({ lines: [line({ unitPrice: "34.000" })] }))).toBe("VALIDATION");
    expect(code(input({ lines: [line({ kitchenNote: 5 })] }))).toBe("VALIDATION");
    expect(code(input({ lines: [line({ placedBy: ID })] }))).toBe("VALIDATION");
    expect(code(null)).toBe("VALIDATION");
  });
});

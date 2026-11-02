import { describe, it, expect } from "vitest";
import {
  compatibleUnits,
  checkSubRecipeChange,
  hasVersionChanges,
  validateRecipe,
  versionAt,
  type ComponentInfo,
  type ComponentRef,
} from "./recipe";
import { d } from "../shared/decimal";
import { dishData, itemLine, prepData, prepLine } from "../../../tests/builders/recipe-data";

const COMPONENTS: ComponentInfo[] = [
  { ref: { kind: "ITEM", id: "pao" }, name: "Pão", active: true, unit: "un", isSubRecipe: false },
  { ref: { kind: "ITEM", id: "carne" }, name: "Carne", active: true, unit: "kg", isSubRecipe: false },
  { ref: { kind: "ITEM", id: "queijo" }, name: "Queijo", active: true, unit: "kg", isSubRecipe: false },
  { ref: { kind: "ITEM", id: "tomate" }, name: "Tomate", active: true, unit: "kg", isSubRecipe: false },
  { ref: { kind: "ITEM", id: "cebola" }, name: "Cebola", active: true, unit: "kg", isSubRecipe: false },
  { ref: { kind: "ITEM", id: "velho" }, name: "Item inativo", active: false, unit: "kg", isSubRecipe: false },
  { ref: { kind: "RECIPE", id: "molho" }, name: "Molho", active: true, unit: "kg", isSubRecipe: true },
  { ref: { kind: "RECIPE", id: "xsalada" }, name: "X-Salada", active: true, unit: "un", isSubRecipe: false },
];
const lookup = (ref: ComponentRef) => COMPONENTS.find((c) => c.ref.kind === ref.kind && c.ref.id === ref.id);

const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "OK" : r.error!.code);
const field = (r: { ok: boolean; error?: { field?: string } }) => (r.ok ? undefined : r.error!.field);

describe("produto vendido (spec 003, US1)", () => {
  it("aceita o X-Burger com pão 1 un, carne 150 g e queijo 30 g", () => {
    expect(code(validateRecipe(dishData(), lookup))).toBe("OK");
  });

  it("exige nome entre 3 e 120 letras", () => {
    const r = validateRecipe(dishData({ name: "X" }), lookup);
    expect(code(r)).toBe("INVALID_NAME");
    expect(field(r)).toBe("name");
    expect(code(validateRecipe(dishData({ name: "x".repeat(121) }), lookup))).toBe("INVALID_NAME");
  });

  it("exige pelo menos um item (RECIPE_EMPTY)", () => {
    const r = validateRecipe(dishData({ lines: [] }), lookup);
    expect(code(r)).toBe("RECIPE_EMPTY");
    expect(field(r)).toBe("lines");
  });

  it("produto vendido não tem rendimento", () => {
    const r = validateRecipe(dishData({ yieldQuantity: d("1"), yieldUnit: "un" }), lookup);
    expect(code(r)).toBe("VALIDATION");
  });
});

describe("quantidade e medida de cada linha (FR-002, FR-003)", () => {
  it("aceita a medida do item ou outra da mesma família (g para item em kg)", () => {
    expect(code(validateRecipe(dishData({ lines: [itemLine("carne", "0.15", "kg")] }), lookup))).toBe("OK");
    expect(code(validateRecipe(dishData({ lines: [itemLine("carne", "150", "g")] }), lookup))).toBe("OK");
  });

  it("recusa medida de outra família (un num item em kg)", () => {
    const r = validateRecipe(dishData({ lines: [itemLine("pao", "1", "un"), itemLine("carne", "1", "un")] }), lookup);
    expect(code(r)).toBe("UNIT_DIMENSION_MISMATCH");
    expect(field(r)).toBe("lines.1.unit");
  });

  it("recusa medida fora do catálogo", () => {
    const r = validateRecipe(dishData({ lines: [itemLine("carne", "1", "xícara" as never)] }), lookup);
    expect(code(r)).toBe("UNKNOWN_UNIT");
  });

  it.each(["0", "-1", "0.00001"])("recusa quantidade %s (maior que zero, até 4 casas)", (q) => {
    const r = validateRecipe(dishData({ lines: [itemLine("carne", q, "kg")] }), lookup);
    expect(code(r)).toBe("INVALID_QUANTITY");
    expect(field(r)).toBe("lines.0.quantity");
  });

  it("recusa o mesmo item duas vezes", () => {
    const r = validateRecipe(dishData({ lines: [itemLine("carne", "100", "g"), itemLine("carne", "50", "g")] }), lookup);
    expect(code(r)).toBe("DUPLICATE_RECIPE_COMPONENT");
    expect(field(r)).toBe("lines.1.component");
  });

  it("recusa item que não existe", () => {
    const r = validateRecipe(dishData({ lines: [itemLine("nada", "1", "kg")] }), lookup);
    expect(code(r)).toBe("NOT_FOUND");
    expect(field(r)).toBe("lines.0.component");
  });

  it("item inativo não entra em linha nova", () => {
    const r = validateRecipe(dishData({ lines: [itemLine("velho", "1", "kg")] }), lookup);
    expect(code(r)).toBe("COMPONENT_INACTIVE");
  });

  it("item inativado depois continua na linha que já existia", () => {
    const previous = [itemLine("velho", "1", "kg")];
    expect(code(validateRecipe(dishData({ lines: [itemLine("velho", "2", "kg")] }), lookup, { previous }))).toBe("OK");
  });
});

describe("preparos (spec 003, US4)", () => {
  it("aceita o molho que rende 2 kg", () => {
    expect(code(validateRecipe(prepData(), lookup))).toBe("OK");
  });

  it("preparo precisa dizer quanto rende", () => {
    const r = validateRecipe(prepData({ yieldQuantity: null }), lookup);
    expect(code(r)).toBe("INVALID_YIELD");
    expect(field(r)).toBe("yieldQuantity");
    expect(code(validateRecipe(prepData({ yieldQuantity: d("0") }), lookup))).toBe("INVALID_YIELD");
    expect(field(validateRecipe(prepData({ yieldUnit: null }), lookup))).toBe("yieldUnit");
  });

  it("um produto pode usar um preparo na medida do rendimento ou da mesma família", () => {
    const lines = [itemLine("pao", "1", "un"), prepLine("molho", "50", "g")];
    expect(code(validateRecipe(dishData({ lines }), lookup))).toBe("OK");
    const wrong = validateRecipe(dishData({ lines: [prepLine("molho", "1", "un")] }), lookup);
    expect(code(wrong)).toBe("UNIT_DIMENSION_MISMATCH");
  });

  it("produto vendido não entra dentro de outro", () => {
    const r = validateRecipe(dishData({ lines: [prepLine("xsalada", "1", "un")] }), lookup);
    expect(code(r)).toBe("NOT_A_SUB_RECIPE");
    expect(field(r)).toBe("lines.0.component");
  });

  it("o preparo não pode usar a si mesmo", () => {
    const r = validateRecipe(prepData({ lines: [prepLine("molho", "1", "kg")] }), lookup, { selfId: "molho" });
    expect(code(r)).toBe("RECIPE_CYCLE");
  });
});

describe("preparo em uso (FR-010)", () => {
  const current = { kind: "SUB_RECIPE" as const, yieldUnit: "kg" as const };

  it("sem uso, pode mudar à vontade", () => {
    expect(code(checkSubRecipeChange(current, { kind: "DISH", yieldUnit: null }, []))).toBe("OK");
  });

  it("em uso, não vira produto vendido", () => {
    const r = checkSubRecipeChange(current, { kind: "DISH", yieldUnit: null }, ["X-Burger"]);
    expect(code(r)).toBe("RECIPE_IN_USE");
    if (!r.ok) expect(r.error.details).toEqual({ usedBy: ["X-Burger"] });
  });

  it("em uso, troca kg por g mas não por un", () => {
    expect(code(checkSubRecipeChange(current, { kind: "SUB_RECIPE", yieldUnit: "g" }, ["X-Burger"]))).toBe("OK");
    expect(code(checkSubRecipeChange(current, { kind: "SUB_RECIPE", yieldUnit: "un" }, ["X-Burger"]))).toBe(
      "RECIPE_IN_USE",
    );
  });

  it("em uso, não pode ser inativado", () => {
    expect(code(checkSubRecipeChange(current, null, ["X-Burger"]))).toBe("RECIPE_IN_USE");
    expect(code(checkSubRecipeChange(current, null, []))).toBe("OK");
  });
});

describe("versões (FR-004)", () => {
  it("mudar quantidade, linha ou rendimento gera versão; nada mudar não", () => {
    const cur = dishData();
    expect(hasVersionChanges(null, cur)).toBe(true);
    expect(hasVersionChanges(cur, dishData({ name: "Outro nome" }))).toBe(false);
    expect(hasVersionChanges(cur, dishData({ lines: [...cur.lines.slice(0, 2), itemLine("queijo", "0.03", "kg")] }))).toBe(
      true,
    );
    expect(hasVersionChanges(cur, dishData({ lines: [itemLine("pao", "1.0", "un"), ...cur.lines.slice(1)] }))).toBe(false);
    expect(hasVersionChanges(cur, dishData({ lines: cur.lines.slice(0, 2) }))).toBe(true);
    const prep = prepData();
    expect(hasVersionChanges(prep, prepData({ yieldQuantity: d("3") }))).toBe(true);
  });

  it("vale a última versão com início até a data", () => {
    const v1 = { number: 1, validFrom: new Date("2026-11-01T10:00:00Z") };
    const v2 = { number: 2, validFrom: new Date("2026-11-05T10:00:00Z") };
    expect(versionAt([v2, v1], new Date("2026-10-31T00:00:00Z"))).toBeNull();
    expect(versionAt([v2, v1], new Date("2026-11-03T00:00:00Z"))).toBe(v1);
    expect(versionAt([v1, v2], new Date("2026-11-05T10:00:00Z"))).toBe(v2);
  });
});

describe("medidas que aparecem na linha", () => {
  it("só as da mesma família", () => {
    expect(compatibleUnits("kg")).toEqual(["g", "kg"]);
    expect(compatibleUnits("ml")).toEqual(["ml", "l"]);
    expect(compatibleUnits("un")).toEqual(["un"]);
  });
});

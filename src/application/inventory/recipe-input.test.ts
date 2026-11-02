import { describe, it, expect } from "vitest";
import { parseRecipeForm } from "./recipe-input";

const ITEM = "0193a000-0000-7000-8000-000000000123";
const PREP = "0193a000-0000-7000-8000-000000000456";
const base = {
  name: "X-Burger",
  kind: "DISH",
  "lines.0.component": `ITEM:${ITEM}`,
  "lines.0.quantity": "150",
  "lines.0.unit": "g",
  "lines.1.component": `RECIPE:${PREP}`,
  "lines.1.quantity": "0,05",
  "lines.1.unit": "kg",
};

const code = (r: ReturnType<typeof parseRecipeForm>) => (r.ok ? "OK" : r.error.code);
const field = (r: ReturnType<typeof parseRecipeForm>) => (r.ok ? undefined : r.error.field);

describe("entrada do formulário de produto (spec 003)", () => {
  it("lê as linhas na ordem, com item ou preparo e vírgula decimal", () => {
    const r = parseRecipeForm(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(
      r.value.lines.map((l) => [l.component.kind, l.component.id, l.quantity.toString(), l.unit]),
    ).toEqual([
      ["ITEM", ITEM, "150", "g"],
      ["RECIPE", PREP, "0.05", "kg"],
    ]);
    expect(r.value.yieldQuantity).toBeNull();
  });

  it("produto vendido ignora o rendimento que veio do formulário", () => {
    const r = parseRecipeForm({ ...base, yieldQuantity: "2", yieldUnit: "kg" });
    expect(r).toMatchObject({ ok: true, value: { yieldQuantity: null, yieldUnit: null } });
  });

  it("preparo lê o rendimento", () => {
    const r = parseRecipeForm({ ...base, kind: "SUB_RECIPE", yieldQuantity: "2,5", yieldUnit: "kg" });
    expect(r.ok && [r.value.yieldQuantity?.toString(), r.value.yieldUnit]).toEqual(["2.5", "kg"]);
    const empty = parseRecipeForm({ ...base, kind: "SUB_RECIPE", yieldQuantity: "", yieldUnit: "" });
    expect(empty).toMatchObject({ ok: true, value: { yieldQuantity: null, yieldUnit: null } });
  });

  it("número inválido aponta o campo da linha", () => {
    const r = parseRecipeForm({ ...base, "lines.1.quantity": "abc" });
    expect(code(r)).toBe("INVALID_NUMBER");
    expect(field(r)).toBe("lines.1.quantity");
  });

  it("quantidade vazia vira INVALID_QUANTITY na linha", () => {
    const r = parseRecipeForm({ ...base, "lines.0.quantity": " " });
    expect(code(r)).toBe("INVALID_QUANTITY");
    expect(field(r)).toBe("lines.0.quantity");
  });

  it("linha sem item escolhido aponta o campo do item", () => {
    const r = parseRecipeForm({ ...base, "lines.1.component": "" });
    expect(code(r)).toBe("VALIDATION");
    expect(field(r)).toBe("lines.1.component");
  });

  it("sem linhas, devolve lista vazia (o domínio recusa com RECIPE_EMPTY)", () => {
    const r = parseRecipeForm({ name: "X", kind: "DISH" });
    expect(r.ok && r.value.lines).toEqual([]);
  });

  it("rejeita campos que o usuário não pode enviar", () => {
    for (const extra of ["restaurantId", "active", "lines.0.cost", "versionNumber"]) {
      expect(code(parseRecipeForm({ ...base, [extra]: "x" })), extra).toBe("VALIDATION");
    }
  });

  it("rejeita tipo e medida fora da lista", () => {
    expect(field(parseRecipeForm({ ...base, kind: "COMBO" }))).toBe("kind");
    expect(field(parseRecipeForm({ ...base, "lines.0.unit": "xícara" }))).toBe("lines.0.unit");
  });
});

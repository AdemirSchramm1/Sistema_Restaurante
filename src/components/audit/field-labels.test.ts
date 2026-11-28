import { describe, it, expect } from "vitest";
import { describeChange, showValue } from "./field-labels";

/** Spec 018, R4: o que o histórico mostra para cada tipo de valor, conferido por tabela. */
describe("valores do histórico", () => {
  it.each([
    ["active", true, "sim"],
    ["active", false, "não"],
    ["leadTimeDays", 3, "3"],
    ["type", "INGREDIENT", "Ingrediente"],
    ["type", "OUTRO", "OUTRO"],
    ["storageClass", "FOOD", "Alimentar"],
    ["storageClass", "CHEMICAL", "Químico (limpeza)"],
    ["storageClass", "OUTRO", "OUTRO"],
    ["kind", "SUB_RECIPE", "Preparo (usado dentro de outros produtos)"],
    ["roles", "MANAGER", "Gerente"],
    ["roles", "DONO", "DONO"],
    ["purchaseFactor", "12.50", "12,50"],
    ["name", "Caixa", "Caixa"],
    ["roles", ["MANAGER", "CHEF"], "Gerente, Chef"],
    ["deliveryDays", [], "—"],
    ["name", null, "—"],
    ["name", "", "—"],
    ["inCogsOverride", null, "segue o grupo"],
  ] as const)("%s = %j → %s", (field, value, shown) => {
    expect(showValue(field, value)).toBe(shown);
  });

  it("campo sem nome em português aparece como veio; id interno só diz que mudou", () => {
    expect(describeChange("campoNovo", "a", "b")).toBe("campoNovo: a → b");
    expect(describeChange("subgroupId", "x", "y")).toBe("Subgrupo: alterado");
    expect(describeChange("name", "A", "B")).toBe("Nome: A → B");
  });
});

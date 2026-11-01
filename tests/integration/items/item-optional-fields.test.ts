import { describe, expect, it } from "vitest";
import { newRestaurant, subgroupId, testEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { createItem } from "../../../src/application/inventory/create-item";
import { getItem } from "../../../src/application/inventory/get-item";
import { parseItemForm } from "../../../src/application/inventory/item-input";
import { d } from "../../../src/domain/shared/decimal";

describe("campos opcionais do item (US4, FR-025)", () => {
  it("grava e relê todos os campos sem perder precisão", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const sub = await subgroupId(env, ctx, "02", "01");
    const data = itemData({
      subgroupId: sub,
      description: "Palmito pupunha, vidro 1,8 kg",
      stockUnit: "un",
      recipeUnit: "g",
      purchaseFactor: d("12"),
      conversions: [{ fromUnit: "un", toUnit: "g", factor: d("1700") }],
      eanUnit: "7891000315507",
      eanPackage: "17891000315504",
      financialCategory: "CMV alimentos",
      presentation: "vidro 1,8 kg",
      netWeight: d("1.8000"),
      drainedWeight: d("1.7000"),
      catchWeight: true,
      correctionFactor: d("1.2500"),
      yieldFactor: d("0.9000"),
      storageTempMaxC: d("4.5"),
      receivingTempMinC: d("-2"),
      receivingTempMaxC: d("7"),
      shelfLifeDays: 365,
      openedLifeDays: 3,
      lotControl: true,
      expiryAlertDays: 15,
      allergens: ["MILK", "SOY"],
      ncm: "20089100",
      cest: "1700100",
      origin: "0",
      taxGroup: "Tributado ICMS",
      countable: true,
      countFrequency: "WEEKLY",
    });
    const created = await createItem(env.deps, ctx, data);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const got = await getItem(env.deps, ctx, created.value.id);
    if (!got.ok) throw new Error("getItem");
    const item = got.value.item;
    expect(item.correctionFactor.toFixed(4)).toBe("1.2500");
    expect(item.drainedWeight?.toFixed(4)).toBe("1.7000");
    expect(item.yieldFactor?.toString()).toBe("0.9");
    expect(item.storageTempMaxC?.toString()).toBe("4.5");
    expect(item.receivingTempMinC?.toString()).toBe("-2");
    expect(item.conversions[0]?.factor.toString()).toBe("1700");
    expect([...item.allergens].sort()).toEqual(["MILK", "SOY"]);
    expect(item).toMatchObject({
      eanUnit: "7891000315507",
      eanPackage: "17891000315504",
      financialCategory: "CMV alimentos",
      presentation: "vidro 1,8 kg",
      catchWeight: true,
      shelfLifeDays: 365,
      openedLifeDays: 3,
      lotControl: true,
      expiryAlertDays: 15,
      ncm: "20089100",
      cest: "1700100",
      origin: "0",
      taxGroup: "Tributado ICMS",
      countFrequency: "WEEKLY",
      averageCost: null,
      lastCost: null,
      abcClass: null,
    });
  });

  it("o formulário recusa custos e curva ABC (calculados pelo sistema)", () => {
    const base = {
      description: "Tomate italiano",
      type: "INGREDIENT",
      subgroupId: "0193a000-0000-7000-8000-000000000001",
      stockUnit: "kg",
      recipeUnit: "g",
      purchaseUnitLabel: "Caixa 20 kg",
      purchaseFactor: "20",
    };
    expect(parseItemForm(base).ok).toBe(true);
    for (const extra of [{ averageCost: "10" }, { lastCost: "9,5" }, { abcClass: "A" }])
      expect(parseItemForm({ ...base, ...extra }).ok).toBe(false);
  });

  it("recusa EAN inválido no cadastro", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const r = await createItem(
      env.deps,
      ctx,
      itemData({ subgroupId: await subgroupId(env, ctx, "01", "02"), eanUnit: "7891000315508" }),
    );
    expect(r).toMatchObject({ ok: false, error: { code: "INVALID_EAN", field: "eanUnit" } });
  });
});

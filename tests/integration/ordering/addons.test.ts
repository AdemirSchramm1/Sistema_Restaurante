import { describe, it, expect } from "vitest";
import { addMember, newRestaurant, ownerTestDb, testEnv } from "../harness";
import { code, orderingKitchen, unwrap } from "./fixtures";
import {
  createAddon,
  getAddon,
  listAddons,
  setAddonActive,
  updateAddon,
} from "../../../src/application/ordering/addons";
import { setRecipeActive } from "../../../src/application/inventory/recipes";
import { setItemActive } from "../../../src/application/inventory/set-item-active";
import { d } from "../../../src/domain/shared/decimal";

const cheese = (queijo: string) => ({
  name: "Fatia de queijo",
  component: { kind: "ITEM" as const, id: queijo },
  quantity: d("20"),
  unit: "g" as const,
  price: d("3.00"),
});

describe("adicionais (spec 010, US1)", () => {
  it("cadastra 'Fatia de queijo' e mostra custo, % do preço e faixa", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const k = await orderingKitchen(env, m);
    const { id } = unwrap(await createAddon(env.deps, m, cheese(k.queijo)));
    unwrap(await createAddon(env.deps, m, { ...cheese(k.bacon), name: "Bacon extra", quantity: d("0.03"), unit: "kg", price: d("0") }));

    const list = unwrap(await listAddons(env.deps, m, {}));
    expect(list.map((a) => a.name)).toEqual(["Bacon extra", "Fatia de queijo"]);
    const queijo = list[1]!;
    expect(queijo).toMatchObject({ id, componentName: "Queijo prato", unit: "g", active: true });
    expect(queijo.quantity.toString()).toBe("20");
    expect(queijo.price.toFixed(2)).toBe("3.00");
    // 20 g × R$ 50/kg = R$ 1,00 → 33,33% de R$ 3,00, faixa "OK" (até 35%).
    expect(queijo.cost?.toFixed(2)).toBe("1.00");
    expect(queijo.costShare?.toFixed(2)).toBe("33.33");
    expect(queijo.band).toBe("OK");
    // Grátis: sem % e sem faixa.
    expect(list[0]!.price.isZero()).toBe(true);
    expect(list[0]!.costShare).toBeNull();
    expect(list[0]!.band).toBeNull();

    const one = unwrap(await getAddon(env.deps, m, id));
    expect(one).toMatchObject({ name: "Fatia de queijo", version: 1, componentInactive: false, usedBy: [] });
  });

  it("adicional de preparo usa o custo do preparo", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const k = await orderingKitchen(env, m);
    const { id } = unwrap(
      await createAddon(env.deps, m, {
        name: "Molho extra",
        component: { kind: "RECIPE", id: k.molho },
        quantity: d("50"),
        unit: "g",
        price: d("2"),
      }),
    );
    // Molho 1 kg = cebola 0,5 kg (R$ 2,50) + bacon 0,1 kg (R$ 6,00) = R$ 8,50/kg → 50 g = R$ 0,425.
    expect(unwrap(await getAddon(env.deps, m, id)).cost?.toString()).toBe("0.425");
  });

  it("recusa nome repetido sem diferenciar acentos, preço inválido e medida de outra família", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const k = await orderingKitchen(env, m);
    unwrap(await createAddon(env.deps, m, cheese(k.queijo)));
    expect(code(await createAddon(env.deps, m, { ...cheese(k.queijo), name: "fatia de quéijo" }))).toBe("NAME_IN_USE");
    expect(code(await createAddon(env.deps, m, { ...cheese(k.queijo), name: "B", price: d("-1") }))).toBe(
      "INVALID_PRICE",
    );
    expect(code(await createAddon(env.deps, m, { ...cheese(k.queijo), name: "C", price: d("1.001") }))).toBe(
      "INVALID_PRICE",
    );
    expect(code(await createAddon(env.deps, m, { ...cheese(k.queijo), name: "D", unit: "ml" }))).toBe(
      "UNIT_DIMENSION_MISMATCH",
    );
    expect(code(await createAddon(env.deps, m, { ...cheese(k.queijo), name: "E", quantity: d("0") }))).toBe(
      "INVALID_QUANTITY",
    );
    expect(
      code(await createAddon(env.deps, m, { ...cheese(k.queijo), name: "F", component: { kind: "RECIPE", id: k.burger } })),
    ).toBe("NOT_A_SUB_RECIPE");
    expect(code(await createAddon(env.deps, m, { ...cheese(k.queijo), name: "" }))).toBe("INVALID_NAME");
  });

  it("componente inativo: não deixa criar e avisa nos que já usam", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const k = await orderingKitchen(env, m);
    const { id } = unwrap(await createAddon(env.deps, m, cheese(k.queijo)));
    unwrap(await setItemActive(env.deps, m, k.queijo, 1, false));
    expect(code(await createAddon(env.deps, m, { ...cheese(k.queijo), name: "Outro" }))).toBe("COMPONENT_INACTIVE");
    expect(unwrap(await getAddon(env.deps, m, id)).componentInactive).toBe(true);
    unwrap(await setRecipeActive(env.deps, m, k.molho, 1, false));
    expect(
      code(await createAddon(env.deps, m, { ...cheese(k.queijo), name: "M", component: { kind: "RECIPE", id: k.molho }, unit: "g" })),
    ).toBe("COMPONENT_INACTIVE");
  });

  it("edita com trava otimista, inativa e reativa; o preço vai para a auditoria", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const k = await orderingKitchen(env, m);
    const { id } = unwrap(await createAddon(env.deps, m, cheese(k.queijo)));
    unwrap(await updateAddon(env.deps, m, { id, version: 1, ...cheese(k.queijo), price: d("3.50") }));
    expect(code(await updateAddon(env.deps, m, { id, version: 1, ...cheese(k.queijo) }))).toBe("STALE_RECORD");
    unwrap(await setAddonActive(env.deps, m, { id, active: false, version: 2 }));
    expect(unwrap(await listAddons(env.deps, m, {}))).toHaveLength(0);
    expect(unwrap(await listAddons(env.deps, m, { includeInactive: true }))).toHaveLength(1);
    unwrap(await createAddon(env.deps, m, cheese(k.queijo)));
    expect(code(await setAddonActive(env.deps, m, { id, active: true, version: 3 }))).toBe("NAME_IN_USE");

    const audit = await ownerTestDb().$client.query<{ action: string; changes: Record<string, unknown> }>(
      "select action, changes from audit_log where entity = 'addon' and entity_id = $1 order by occurred_at, id",
      [id],
    );
    expect(audit.rows.map((r) => r.action)).toEqual(["CREATE", "UPDATE", "DEACTIVATE"]);
    expect(audit.rows[0]!.changes).toMatchObject({
      name: [null, "Fatia de queijo"],
      component: [null, "Queijo prato"],
      quantity: [null, "20 g"],
      price: [null, "3.00"],
    });
    expect(audit.rows[1]!.changes).toEqual({ price: ["3.00", "3.50"] });
  });

  it("chef lê; só o gerente escreve, e a tentativa negada fica registrada", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const k = await orderingKitchen(env, m);
    const chef = await addMember(env, m, ["CHEF"]);
    const stock = await addMember(env, m, ["STOCKKEEPER"]);
    const { id } = unwrap(await createAddon(env.deps, m, cheese(k.queijo)));
    expect(code(await listAddons(env.deps, chef, {}))).toBe("OK");
    expect(code(await getAddon(env.deps, chef, id))).toBe("OK");
    expect(code(await createAddon(env.deps, chef, { ...cheese(k.queijo), name: "X" }))).toBe("FORBIDDEN");
    expect(code(await updateAddon(env.deps, chef, { id, version: 1, ...cheese(k.queijo) }))).toBe("FORBIDDEN");
    expect(code(await listAddons(env.deps, stock, {}))).toBe("FORBIDDEN");
    const denied = await ownerTestDb().$client.query(
      "select user_id from audit_log where entity = 'addon' and action = 'DENIED' and restaurant_id = $1",
      [m.restaurantId],
    );
    expect(denied.rows).toHaveLength(3);
  });
});

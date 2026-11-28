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
import {
  getProductCustomization,
  setProductCustomization,
} from "../../../src/application/ordering/customization";
import { d } from "../../../src/domain/shared/decimal";

/** Spec 018, US3: recusas e casos de adicionais e do quadro "Adicionar e tirar" (pedidos/02) que faltavam. */

const MISSING = "00000000-0000-4000-8000-000000000000";
const cheese = (queijo: string) => ({
  name: "Fatia de queijo",
  component: { kind: "ITEM" as const, id: queijo },
  quantity: d("20"),
  unit: "g" as const,
  price: d("3.00"),
});
const auditOf = async (entity: string, id: string) =>
  (
    await ownerTestDb().$client.query(
      "select action from audit_log where entity = $1 and entity_id = $2 and action <> 'DENIED' order by occurred_at, id",
      [entity, id],
    )
  ).rows.map((r) => r.action);

async function setup() {
  const env = testEnv();
  const m = await newRestaurant(env);
  const k = await orderingKitchen(env, m);
  const waiter = await addMember(env, m, ["WAITER"]);
  const chef = await addMember(env, m, ["CHEF"]);
  const id = unwrap(await createAddon(env.deps, m, cheese(k.queijo))).id;
  return { env, m, k, waiter, chef, id };
}

describe("adicionais: recusas (spec 010, US1)", () => {
  it("restaurante sem adicionais nem preparos: lista vazia", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    expect(unwrap(await listAddons(env.deps, m, {}))).toEqual([]);
  });

  it("quem não vê adicionais recebe FORBIDDEN; o chef não escreve", async () => {
    const { env, k, waiter, chef, id } = await setup();
    expect(code(await getAddon(env.deps, waiter, id))).toBe("FORBIDDEN");
    expect(code(await setAddonActive(env.deps, chef, { id, active: false, version: 1 }))).toBe("FORBIDDEN");
    expect(code(await getProductCustomization(env.deps, waiter, k.burger))).toBe("FORBIDDEN");
  });

  it("adicional que não existe é NOT_FOUND; componente que não existe é recusado", async () => {
    const { env, m, k, id } = await setup();
    expect(code(await getAddon(env.deps, m, MISSING))).toBe("NOT_FOUND");
    expect(code(await updateAddon(env.deps, m, { ...cheese(k.queijo), id: MISSING, version: 1 }))).toBe(
      "NOT_FOUND",
    );
    expect(code(await setAddonActive(env.deps, m, { id: MISSING, active: false, version: 1 }))).toBe(
      "NOT_FOUND",
    );
    const ghost = await createAddon(env.deps, m, {
      ...cheese(k.queijo),
      name: "Fantasma",
      component: { kind: "ITEM", id: MISSING },
    });
    expect(ghost.ok ? "OK" : `${ghost.error.code}@${ghost.error.field}`).toBe("NOT_FOUND@component");
    expect(
      code(await updateAddon(env.deps, m, { ...cheese(k.queijo), price: d("-1"), id, version: 1 })),
    ).toBe("INVALID_PRICE");
  });

  it("versão velha é STALE_RECORD e não grava; salvar igual e inativar duas vezes não auditam", async () => {
    const { env, m, k, id } = await setup();
    unwrap(await updateAddon(env.deps, m, { ...cheese(k.queijo), id, version: 1 }));
    expect(code(await updateAddon(env.deps, m, { ...cheese(k.queijo), price: d("5"), id, version: 1 }))).toBe(
      "STALE_RECORD",
    );
    expect(code(await setAddonActive(env.deps, m, { id, active: false, version: 1 }))).toBe("STALE_RECORD");
    unwrap(await setAddonActive(env.deps, m, { id, active: false, version: 2 }));
    unwrap(await setAddonActive(env.deps, m, { id, active: false, version: 3 }));
    unwrap(await setAddonActive(env.deps, m, { id, active: true, version: 4 }));
    expect(await auditOf("addon", id)).toEqual(["CREATE", "DEACTIVATE", "REACTIVATE"]);
    expect(unwrap(await getAddon(env.deps, m, id)).price.toString()).toBe("3");
  });
});

describe("quadro 'Adicionar e tirar': casos (spec 010, US2)", () => {
  it("produto que não existe é NOT_FOUND; salvar o mesmo quadro não grava auditoria", async () => {
    const { env, m, k, id } = await setup();
    const set = (recipeId: string, version: number) =>
      setProductCustomization(env.deps, m, {
        recipeId,
        version,
        addons: [{ addonId: id, maxTimes: 2 }],
        removables: [],
      });
    expect(code(await set(MISSING, 1))).toBe("NOT_FOUND");
    const before = (await auditOf("recipe", k.burger)).length;
    unwrap(await set(k.burger, 2));
    unwrap(await set(k.burger, 3));
    expect((await auditOf("recipe", k.burger)).length).toBe(before + 1);
    const view = unwrap(await getProductCustomization(env.deps, m, k.burger));
    expect(view.candidates.map((c) => c.name)).toEqual([
      "Pão de hambúrguer",
      "Carne moída",
      "Queijo prato",
      "Cebola",
    ]);
  });
});

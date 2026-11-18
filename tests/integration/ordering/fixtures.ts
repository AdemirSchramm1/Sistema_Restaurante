import { sql } from "drizzle-orm";
import { ownerTestDb, subgroupId, type TestEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { itemLine } from "../../builders/recipe-data";
import { createItem } from "../../../src/application/inventory/create-item";
import { createRecipe } from "../../../src/application/inventory/recipes";
import { setRecipeSalePrice } from "../../../src/application/inventory/product-costs";
import type { RequestContext } from "../../../src/application/context";
import { d } from "../../../src/domain/shared/decimal";

export const unwrap = <T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
};
export const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "OK" : r.error!.code);

/**
 * Cozinha dos testes de pedidos (specs 009 e 010): pão R$ 1,00/un, carne R$ 40/kg, queijo R$ 50/kg,
 * cebola R$ 5/kg, bacon R$ 60/kg, laranja R$ 4/kg. X-Burger (pão 1, carne 150 g, queijo 30 g,
 * cebola 20 g) a R$ 28,00; Suco (laranja 300 g) a R$ 9,00; Molho da casa (preparo, rende 1 kg).
 */
export async function orderingKitchen(env: TestEnv, ctx: RequestContext) {
  const sub = await subgroupId(env, ctx, "01", "02");
  const make = async (description: string, stockUnit: "un" | "kg", cost: string) => {
    const id = unwrap(
      await createItem(
        env.deps,
        ctx,
        itemData({ subgroupId: sub, description, stockUnit, purchaseUnitLabel: null, purchaseFactor: null }),
      ),
    ).id;
    await ownerTestDb().execute(sql`update items set average_cost = ${cost} where id = ${id}`);
    return id;
  };
  const pao = await make("Pão de hambúrguer", "un", "1");
  const carne = await make("Carne moída", "kg", "40");
  const queijo = await make("Queijo prato", "kg", "50");
  const cebola = await make("Cebola", "kg", "5");
  const bacon = await make("Bacon", "kg", "60");
  const laranja = await make("Laranja", "kg", "4");
  const molho = unwrap(
    await createRecipe(env.deps, ctx, {
      name: "Molho da casa",
      kind: "SUB_RECIPE",
      yieldQuantity: d("1"),
      yieldUnit: "kg",
      lines: [itemLine(cebola, "500", "g"), itemLine(bacon, "100", "g")],
    }),
  ).id;
  const burger = unwrap(
    await createRecipe(env.deps, ctx, {
      name: "X-Burger",
      kind: "DISH",
      yieldQuantity: null,
      yieldUnit: null,
      lines: [
        itemLine(pao, "1", "un"),
        itemLine(carne, "150", "g"),
        itemLine(queijo, "30", "g"),
        itemLine(cebola, "20", "g"),
      ],
    }),
  ).id;
  const suco = unwrap(
    await createRecipe(env.deps, ctx, {
      name: "Suco",
      kind: "DISH",
      yieldQuantity: null,
      yieldUnit: null,
      lines: [itemLine(laranja, "300", "g")],
    }),
  ).id;
  unwrap(await setRecipeSalePrice(env.deps, ctx, burger, 1, d("28.00")));
  unwrap(await setRecipeSalePrice(env.deps, ctx, suco, 1, d("9.00")));
  return { pao, carne, queijo, cebola, bacon, laranja, molho, burger, suco };
}

/** Cria a mesa e devolve o token do QR code (o que vai impresso). */
export async function tableWithQr(env: TestEnv, ctx: RequestContext, name: string) {
  const { createTable, tableQrCodes } = await import("../../../src/application/ordering/tables");
  const { id } = unwrap(await createTable(env.deps, ctx, { name }));
  const qr = unwrap(await tableQrCodes(env.deps, ctx, { ids: [id] }));
  return { tableId: id, token: qr.tables[0]!.url.split("/m/")[1]! };
}

/** Escaneia o QR code: devolve o cookie do acesso de 20 minutos. */
export async function scan(env: TestEnv, token: string, previousCookie: string | null = null) {
  const { openMenuAccess } = await import("../../../src/application/ordering/menu-access");
  return unwrap(
    await openMenuAccess(env.deps, {
      qrToken: token,
      previousCookie,
      origin: { ip: "203.0.113.7", userAgent: "Celular de teste" },
    }),
  ).cookie;
}

/** Restaurante com X-Burger (+ queijo até 2, "Sem cebola") e Suco, mesa 12 e um celular com acesso aberto. */
export async function orderingScenario(env: TestEnv, m: RequestContext) {
  const { createAddon } = await import("../../../src/application/ordering/addons");
  const { setProductCustomization } = await import("../../../src/application/ordering/customization");
  const k = await orderingKitchen(env, m);
  const cheese = unwrap(
    await createAddon(env.deps, m, {
      name: "Fatia de queijo",
      component: { kind: "ITEM", id: k.queijo },
      quantity: d("20"),
      unit: "g",
      price: d("3.00"),
    }),
  ).id;
  unwrap(
    await setProductCustomization(env.deps, m, {
      recipeId: k.burger,
      version: 2,
      addons: [{ addonId: cheese, maxTimes: 2 }],
      removables: [{ component: { kind: "ITEM", id: k.cebola } }],
    }),
  );
  const table = await tableWithQr(env, m, "12");
  const cookie = await scan(env, table.token);
  const burger = (quantity = 1) => ({
    recipeId: k.burger,
    quantity,
    unitPrice: "34.00",
    addons: [{ addonId: cheese, times: 2, unitPrice: "3.00" }],
    removals: [{ kind: "ITEM", id: k.cebola }],
  });
  const juice = (quantity = 1) => ({
    recipeId: k.suco,
    quantity,
    unitPrice: "9.00",
    addons: [],
    removals: [],
  });
  const place = async (lines: unknown[]) => {
    const { submitOrder } = await import("../../../src/application/ordering/submit-order");
    return unwrap(await submitOrder(env.deps, cookie, { clientRequestId: crypto.randomUUID(), lines }));
  };
  return { ...k, burgerId: k.burger, cheese, table, cookie, burger, juice, place };
}

/** Cria o link do tablet da mesa e liga um aparelho: devolve o cookie do tablet (spec 016). */
export async function tablet(env: TestEnv, ctx: RequestContext, tableId: string) {
  const { createTabletLink } = await import("../../../src/application/ordering/tablets");
  const { bindTablet } = await import("../../../src/application/ordering/menu-access");
  const { ownerTestDb } = await import("../harness");
  const { sql } = await import("drizzle-orm");
  const row = async () =>
    (
      await ownerTestDb().execute<{ version: number; tablet_token: string | null }>(
        sql`select version, tablet_token from dining_tables where id = ${tableId}`,
      )
    ).rows[0]!;
  const before = await row();
  if (!before.tablet_token)
    unwrap(await createTabletLink(env.deps, ctx, { tableId, version: before.version }));
  const bound = await bindTablet(env.deps, {
    tabletToken: (await row()).tablet_token!,
    cookie: null,
    origin: { ip: "203.0.113.9", userAgent: "Tablet de teste" },
  });
  if (bound.kind !== "BOUND") throw new Error(`tablet não ligou: ${bound.kind}`);
  return bound.cookie;
}

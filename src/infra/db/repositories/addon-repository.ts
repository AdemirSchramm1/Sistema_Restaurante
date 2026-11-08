import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { AddonRecord, AddonRepo, CustomizationRepo } from "@/application/ordering/ports";
import type { Audit } from "@/application/access/ports";
import type { ComponentRef } from "@/domain/inventory/recipe";
import { err, ok, type Result } from "@/domain/shared/result";
import type { Tx } from "../db";
import { addons, items, recipeAddons, recipeRemovables, recipes } from "../schema";
import { dec, isUniqueViolation, UNIT_CODE_BY_ID, UNIT_IDS, withSavepoint } from "./util";

const ref = (itemId: string | null, subRecipeId: string | null): ComponentRef =>
  itemId ? { kind: "ITEM", id: itemId } : { kind: "RECIPE", id: subRecipeId! };

const componentCols = (c: ComponentRef) => ({
  itemId: c.kind === "ITEM" ? c.id : null,
  subRecipeId: c.kind === "RECIPE" ? c.id : null,
});

/** Adicionais (spec 010, US1). */
export function addonRepository(tx: Tx, restaurantId: string): AddonRepo {
  async function load(where: SQL | undefined): Promise<AddonRecord[]> {
    const rows = await tx
      .select({
        id: addons.id,
        name: addons.name,
        itemId: addons.itemId,
        subRecipeId: addons.subRecipeId,
        quantity: addons.quantity,
        unitId: addons.unitId,
        price: addons.price,
        active: addons.active,
        version: addons.version,
        itemName: items.description,
        itemActive: items.active,
        recipeName: sql<string | null>`(select r.name from ${recipes} r where r.id = ${addons.subRecipeId})`,
        recipeActive: sql<
          boolean | null
        >`(select r.active from ${recipes} r where r.id = ${addons.subRecipeId})`,
      })
      .from(addons)
      .leftJoin(items, eq(items.id, addons.itemId))
      .where(where)
      .orderBy(asc(addons.nameNormalized));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      component: ref(r.itemId, r.subRecipeId),
      componentName: (r.itemName ?? r.recipeName)!,
      componentActive: (r.itemActive ?? r.recipeActive) === true,
      quantity: dec(r.quantity)!,
      unit: UNIT_CODE_BY_ID[r.unitId]!,
      price: dec(r.price)!,
      active: r.active,
      version: r.version,
    }));
  }

  async function guarded(fn: () => Promise<Result<void>>): Promise<Result<void>> {
    try {
      return await withSavepoint(tx, fn);
    } catch (e) {
      if (isUniqueViolation(e, "addons_active_name")) return err("NAME_IN_USE", "name");
      throw e;
    }
  }

  async function optimistic(id: string, version: number, set: Record<string, unknown>, audit: Audit) {
    const r = await tx
      .update(addons)
      .set({ ...set, version: version + 1, updatedAt: audit.at, updatedBy: audit.by })
      .where(and(eq(addons.id, id), eq(addons.version, version)))
      .returning({ id: addons.id });
    if (r.length) return ok(undefined);
    const exists = await tx.select({ id: addons.id }).from(addons).where(eq(addons.id, id));
    return exists.length ? err("STALE_RECORD") : err("NOT_FOUND");
  }

  return {
    list: (includeInactive) => load(includeInactive ? undefined : eq(addons.active, true)),
    async get(id) {
      const [r] = await load(eq(addons.id, id));
      return r ?? null;
    },
    getMany: (ids) => (ids.length ? load(inArray(addons.id, [...ids])) : Promise.resolve([])),
    insert: (a, audit) =>
      guarded(async () => {
        await tx.insert(addons).values({
          id: a.id,
          restaurantId,
          name: a.name,
          nameNormalized: a.normalized,
          ...componentCols(a.component),
          quantity: a.quantity.toString(),
          unitId: UNIT_IDS[a.unit],
          price: a.price.toFixed(2),
          createdAt: audit.at,
          createdBy: audit.by,
          updatedAt: audit.at,
          updatedBy: audit.by,
        });
        return ok(undefined);
      }),
    update: (id, a, version, audit) =>
      guarded(() =>
        optimistic(
          id,
          version,
          {
            name: a.name,
            nameNormalized: a.normalized,
            ...componentCols(a.component),
            quantity: a.quantity.toString(),
            unitId: UNIT_IDS[a.unit],
            price: a.price.toFixed(2),
          },
          audit,
        ),
      ),
    setActive: (id, active, version, audit) => guarded(() => optimistic(id, version, { active }, audit)),
    async usedBy(id) {
      return tx
        .select({ id: recipes.id, name: recipes.name })
        .from(recipeAddons)
        .innerJoin(recipes, eq(recipes.id, recipeAddons.recipeId))
        .where(eq(recipeAddons.addonId, id))
        .orderBy(asc(recipes.nameNormalized));
    },
  };
}

/** Quadro "Adicionar e tirar" do produto (spec 010, US2). */
export function customizationRepository(tx: Tx, restaurantId: string, ids: () => string): CustomizationRepo {
  return {
    async get(recipeId) {
      const offered = await tx
        .select({
          addonId: addons.id,
          name: addons.name,
          price: addons.price,
          maxTimes: recipeAddons.maxTimes,
          active: addons.active,
        })
        .from(recipeAddons)
        .innerJoin(addons, eq(addons.id, recipeAddons.addonId))
        .where(eq(recipeAddons.recipeId, recipeId))
        .orderBy(asc(recipeAddons.position));
      const removables = await tx
        .select()
        .from(recipeRemovables)
        .where(eq(recipeRemovables.recipeId, recipeId))
        .orderBy(asc(recipeRemovables.position));
      return {
        addons: offered.map((a) => ({ ...a, price: dec(a.price)! })),
        removables: removables.map((r) => ({ component: ref(r.itemId, r.subRecipeId), label: r.label })),
      };
    },

    async replace(recipeId, config, version, audit) {
      const r = await tx
        .update(recipes)
        .set({ version: version + 1, updatedAt: audit.at, updatedBy: audit.by })
        .where(and(eq(recipes.id, recipeId), eq(recipes.version, version)))
        .returning({ id: recipes.id });
      if (!r.length) {
        const exists = await tx.select({ id: recipes.id }).from(recipes).where(eq(recipes.id, recipeId));
        return exists.length ? err("STALE_RECORD") : err("NOT_FOUND");
      }
      await tx.delete(recipeAddons).where(eq(recipeAddons.recipeId, recipeId));
      await tx.delete(recipeRemovables).where(eq(recipeRemovables.recipeId, recipeId));
      if (config.addons.length)
        await tx.insert(recipeAddons).values(
          config.addons.map((a, position) => ({
            id: ids(),
            restaurantId,
            createdAt: audit.at,
            createdBy: audit.by,
            recipeId,
            addonId: a.addonId,
            maxTimes: a.maxTimes,
            position,
          })),
        );
      if (config.removables.length)
        await tx.insert(recipeRemovables).values(
          config.removables.map((x, position) => ({
            id: ids(),
            restaurantId,
            createdAt: audit.at,
            createdBy: audit.by,
            recipeId,
            ...componentCols(x.component),
            label: x.label,
            position,
          })),
        );
      return ok(undefined);
    },
  };
}

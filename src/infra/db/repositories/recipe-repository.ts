import { and, asc, desc, eq, ilike, inArray, lte, ne, sql, type SQL } from "drizzle-orm";
import type {
  ComponentRecord,
  RecipeListRow,
  RecipeRecord,
  RecipeRepo,
  RecipeVersionRecord,
} from "@/application/inventory/ports";
import type { Audit } from "@/application/access/ports";
import type { RecipeLineData } from "@/domain/inventory/recipe";
import type { RecipeNode } from "@/domain/inventory/recipe-graph";
import { normalizeDescription } from "@/domain/inventory/description";
import { err, ok, type Result } from "@/domain/shared/result";
import type { Tx } from "../db";
import { items, recipeLines, recipes, recipeVersions } from "../schema";
import { dec, isUniqueViolation, str, UNIT_CODE_BY_ID, UNIT_IDS, withSavepoint } from "./util";

type VersionRow = typeof recipeVersions.$inferSelect;
type LineRow = typeof recipeLines.$inferSelect;

const toLine = (l: LineRow): RecipeLineData => ({
  component: l.itemId ? { kind: "ITEM", id: l.itemId } : { kind: "RECIPE", id: l.subRecipeId! },
  quantity: dec(l.quantity)!,
  unit: UNIT_CODE_BY_ID[l.unitId]!,
});

const toRecord = (r: typeof recipes.$inferSelect, current: RecipeVersionRecord): RecipeRecord => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  active: r.active,
  version: r.version,
  salePrice: dec(r.salePrice),
  current,
});

export function recipeRepository(tx: Tx, restaurantId: string): RecipeRepo {
  /** Versão mais nova de cada produto. */
  const latest = tx
    .selectDistinctOn([recipeVersions.recipeId])
    .from(recipeVersions)
    .orderBy(recipeVersions.recipeId, desc(recipeVersions.number))
    .as("latest");

  async function withLines(versions: VersionRow[]): Promise<Map<string, RecipeVersionRecord>> {
    const out = new Map<string, RecipeVersionRecord>();
    if (!versions.length) return out;
    const lines = await tx
      .select()
      .from(recipeLines)
      .where(
        inArray(
          recipeLines.recipeVersionId,
          versions.map((v) => v.id),
        ),
      )
      .orderBy(asc(recipeLines.position));
    for (const v of versions)
      out.set(v.id, {
        id: v.id,
        number: v.number,
        validFrom: v.validFrom,
        yieldQuantity: dec(v.yieldQuantity),
        yieldUnit: v.yieldUnitId ? UNIT_CODE_BY_ID[v.yieldUnitId]! : null,
        lines: lines.filter((l) => l.recipeVersionId === v.id).map(toLine),
      });
    return out;
  }

  async function latestVersions(recipeIds: string[]): Promise<Map<string, RecipeVersionRecord>> {
    if (!recipeIds.length) return new Map();
    const rows = await tx
      .selectDistinctOn([recipeVersions.recipeId])
      .from(recipeVersions)
      .where(inArray(recipeVersions.recipeId, recipeIds))
      .orderBy(recipeVersions.recipeId, desc(recipeVersions.number));
    const byVersion = await withLines(rows);
    return new Map(rows.map((r) => [r.recipeId, byVersion.get(r.id)!]));
  }

  async function guarded(fn: () => Promise<Result<void>>): Promise<Result<void>> {
    try {
      return await withSavepoint(tx, fn);
    } catch (e) {
      if (isUniqueViolation(e, "recipes_active_name")) return err("RECIPE_DUPLICATE_NAME", "name");
      throw e;
    }
  }

  async function optimistic(id: string, version: number, set: Record<string, unknown>, audit: Audit) {
    const r = await tx
      .update(recipes)
      .set({ ...set, version: version + 1, updatedAt: audit.at, updatedBy: audit.by })
      .where(and(eq(recipes.id, id), eq(recipes.version, version)))
      .returning({ id: recipes.id });
    if (r.length) return ok(undefined);
    const exists = await tx.select({ id: recipes.id }).from(recipes).where(eq(recipes.id, id));
    return exists.length ? err("STALE_RECORD") : err("NOT_FOUND");
  }

  const repo: RecipeRepo = {
    insert: (r, audit) =>
      guarded(async () => {
        await tx.insert(recipes).values({
          id: r.id,
          restaurantId,
          name: r.name.trim(),
          nameNormalized: r.nameNormalized,
          kind: r.kind,
          createdAt: audit.at,
          createdBy: audit.by,
          updatedAt: audit.at,
          updatedBy: audit.by,
        });
        return ok(undefined);
      }),

    update: (id, r, version, audit) =>
      guarded(() =>
        optimistic(
          id,
          version,
          { name: r.name.trim(), nameNormalized: r.nameNormalized, kind: r.kind },
          audit,
        ),
      ),

    setActive: (id, active, version, audit) => guarded(() => optimistic(id, version, { active }, audit)),

    setSalePrice: (id, salePrice, version, audit) =>
      optimistic(id, version, { salePrice: salePrice ? salePrice.toFixed(2) : null }, audit),

    async insertVersion(v, lineIds, audit) {
      await tx.insert(recipeVersions).values({
        id: v.id,
        restaurantId,
        recipeId: v.recipeId,
        number: v.number,
        validFrom: v.validFrom,
        yieldQuantity: str(v.yieldQuantity),
        yieldUnitId: v.yieldUnit ? UNIT_IDS[v.yieldUnit] : null,
        createdAt: audit.at,
        createdBy: audit.by,
      });
      await tx.insert(recipeLines).values(
        v.lines.map((l, position) => ({
          id: lineIds(),
          restaurantId,
          recipeVersionId: v.id,
          position,
          itemId: l.component.kind === "ITEM" ? l.component.id : null,
          subRecipeId: l.component.kind === "RECIPE" ? l.component.id : null,
          quantity: l.quantity.toString(),
          unitId: UNIT_IDS[l.unit],
          createdAt: audit.at,
          createdBy: audit.by,
        })),
      );
    },

    async get(id) {
      const [r] = await tx.select().from(recipes).where(eq(recipes.id, id));
      if (!r) return null;
      const current = (await latestVersions([id])).get(id);
      if (!current) return null;
      return toRecord(r, current);
    },

    async activeWithLatest() {
      const rows = await tx
        .select()
        .from(recipes)
        .where(eq(recipes.active, true))
        .orderBy(asc(recipes.nameNormalized));
      const versions = await latestVersions(rows.map((r) => r.id));
      return rows.filter((r) => versions.has(r.id)).map((r) => toRecord(r, versions.get(r.id)!));
    },

    async versionAt(recipeId, at) {
      const rows = await tx
        .select()
        .from(recipeVersions)
        .where(and(eq(recipeVersions.recipeId, recipeId), lte(recipeVersions.validFrom, at)))
        .orderBy(desc(recipeVersions.validFrom), desc(recipeVersions.number))
        .limit(1);
      if (!rows.length) return null;
      return (await withLines(rows)).get(rows[0]!.id)!;
    },

    async list(f) {
      const where: SQL[] = [];
      if (f.status !== "all") where.push(eq(recipes.active, f.status !== "inactive"));
      if (f.kind) where.push(eq(recipes.kind, f.kind));
      const q = f.q?.trim();
      if (q)
        where.push(ilike(recipes.nameNormalized, `%${normalizeDescription(q).replace(/[%_\\]/g, "\\$&")}%`));
      const rows = await tx
        .select({
          id: recipes.id,
          name: recipes.name,
          kind: recipes.kind,
          active: recipes.active,
          versionNumber: latest.number,
          lineCount: sql<number>`(select count(*)::int from ${recipeLines} where ${recipeLines.recipeVersionId} = ${latest.id})`,
        })
        .from(recipes)
        .innerJoin(latest, eq(latest.recipeId, recipes.id))
        .where(where.length ? and(...where) : undefined)
        .orderBy(asc(recipes.nameNormalized));
      return rows.map((r): RecipeListRow => ({ ...r, lineCount: Number(r.lineCount) }));
    },

    async findActiveByName(normalized, exceptId) {
      const [r] = await tx
        .select({ id: recipes.id })
        .from(recipes)
        .where(
          and(
            eq(recipes.nameNormalized, normalized),
            eq(recipes.active, true),
            exceptId ? ne(recipes.id, exceptId) : undefined,
          ),
        );
      return r ?? null;
    },

    async subRecipeGraph() {
      const preps = await tx.select().from(recipes).where(eq(recipes.kind, "SUB_RECIPE"));
      const versions = await latestVersions(preps.map((p) => p.id));
      const graph = new Map<string, RecipeNode>();
      for (const p of preps) {
        const v = versions.get(p.id);
        if (v)
          graph.set(p.id, {
            id: p.id,
            name: p.name,
            kind: p.kind,
            yieldQuantity: v.yieldQuantity,
            yieldUnit: v.yieldUnit,
            lines: v.lines,
          });
      }
      return graph;
    },

    async usedBy(recipeId) {
      const rows = await tx
        .selectDistinct({ name: recipes.name })
        .from(recipeLines)
        .innerJoin(latest, eq(latest.id, recipeLines.recipeVersionId))
        .innerJoin(recipes, eq(recipes.id, latest.recipeId))
        .where(and(eq(recipeLines.subRecipeId, recipeId), eq(recipes.active, true)))
        .orderBy(asc(recipes.name));
      return rows.map((r) => r.name);
    },

    async components(refs) {
      const itemIds = refs.filter((r) => r.kind === "ITEM").map((r) => r.id);
      const recipeIds = refs.filter((r) => r.kind === "RECIPE").map((r) => r.id);
      return [
        ...(itemIds.length ? await itemComponents(inArray(items.id, itemIds)) : []),
        ...(recipeIds.length ? await recipeComponents(inArray(recipes.id, recipeIds)) : []),
      ];
    },

    async activeComponents() {
      return [
        ...(await itemComponents(eq(items.active, true))),
        ...(await recipeComponents(and(eq(recipes.active, true), eq(recipes.kind, "SUB_RECIPE"))!)),
      ];
    },
  };

  async function itemComponents(where: SQL): Promise<ComponentRecord[]> {
    const rows = await tx
      .select({
        id: items.id,
        name: items.description,
        active: items.active,
        unitId: items.stockUnitId,
        averageCost: items.averageCost,
      })
      .from(items)
      .where(where)
      .orderBy(asc(items.descriptionNormalized));
    return rows.map((r) => ({
      ref: { kind: "ITEM", id: r.id },
      name: r.name,
      active: r.active,
      unit: UNIT_CODE_BY_ID[r.unitId]!,
      isSubRecipe: false,
      averageCost: dec(r.averageCost),
    }));
  }

  async function recipeComponents(where: SQL): Promise<ComponentRecord[]> {
    const rows = await tx
      .select({ id: recipes.id, name: recipes.name, active: recipes.active, kind: recipes.kind })
      .from(recipes)
      .where(where)
      .orderBy(asc(recipes.nameNormalized));
    const versions = await latestVersions(rows.map((r) => r.id));
    return rows.map((r) => {
      const v = versions.get(r.id);
      return {
        ref: { kind: "RECIPE", id: r.id },
        name: r.name,
        active: r.active,
        // Produto vendido rende 1 unidade.
        unit: v?.yieldUnit ?? "un",
        isSubRecipe: r.kind === "SUB_RECIPE",
        averageCost: null,
      };
    });
  }

  return repo;
}

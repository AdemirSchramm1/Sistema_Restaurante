import { and, asc, eq, ilike, ne, or, sql, type SQL } from "drizzle-orm";
import type { ItemListRow, ItemRepo } from "@/application/inventory/ports";
import type { Item, ItemData } from "@/domain/inventory/item";
import type { Allergen } from "@/domain/inventory/allergens";
import { normalizeDescription } from "@/domain/inventory/description";
import { d } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";
import type { Tx } from "../db";
import { itemGroups, itemSubgroups, itemUnitConversions, items } from "../schema";
import { dec, isUniqueViolation, str, UNIT_CODE_BY_ID, UNIT_IDS, withSavepoint } from "./util";

type Audit = { at: Date; by: string | null };

function toRow(data: ItemData & { descriptionNormalized: string }) {
  return {
    description: data.description.trim(),
    descriptionNormalized: data.descriptionNormalized,
    type: data.type,
    subgroupId: data.subgroupId,
    stockUnitId: UNIT_IDS[data.stockUnit],
    recipeUnitId: UNIT_IDS[data.recipeUnit],
    purchaseUnitLabel: data.purchaseUnitLabel.trim(),
    purchaseFactor: data.purchaseFactor.toString(),
    eanUnit: data.eanUnit,
    eanPackage: data.eanPackage,
    noGtin: data.noGtin,
    financialCategory: data.financialCategory,
    presentation: data.presentation,
    netWeight: str(data.netWeight),
    drainedWeight: str(data.drainedWeight),
    catchWeight: data.catchWeight,
    correctionFactor: data.correctionFactor.toString(),
    yieldFactor: str(data.yieldFactor),
    storageTempMaxC: str(data.storageTempMaxC),
    receivingTempMinC: str(data.receivingTempMinC),
    receivingTempMaxC: str(data.receivingTempMaxC),
    shelfLifeDays: data.shelfLifeDays,
    openedLifeDays: data.openedLifeDays,
    lotControl: data.lotControl,
    expiryAlertDays: data.expiryAlertDays,
    allergens: data.allergens,
    ncm: data.ncm,
    cest: data.cest,
    origin: data.origin,
    taxGroup: data.taxGroup,
    countable: data.countable,
    countFrequency: data.countFrequency,
  };
}

export function itemRepository(tx: Tx, restaurantId: string, ids: () => string): ItemRepo {
  async function writeConversions(itemId: string, data: ItemData, audit: Audit) {
    await tx.delete(itemUnitConversions).where(eq(itemUnitConversions.itemId, itemId));
    if (data.conversions.length)
      await tx.insert(itemUnitConversions).values(
        data.conversions.map((c) => ({
          id: ids(),
          restaurantId,
          itemId,
          fromUnitId: UNIT_IDS[c.fromUnit],
          toUnitId: UNIT_IDS[c.toUnit],
          factor: c.factor.toString(),
          createdAt: audit.at,
          createdBy: audit.by,
        })),
      );
  }

  async function guarded(
    fn: () => Promise<Result<void>>,
    subgroupId: string,
    normalized: string,
    exceptId?: string,
  ) {
    try {
      return await withSavepoint(tx, fn);
    } catch (e) {
      if (isUniqueViolation(e, "items_active_description")) {
        const existing = await repo.findActiveByDescription(subgroupId, normalized, exceptId);
        return err("ITEM_DUPLICATE_DESCRIPTION", "description", { existingCode: existing?.code });
      }
      throw e;
    }
  }

  async function optimistic(
    id: string,
    version: number,
    set: Record<string, unknown>,
    audit: Audit,
  ): Promise<Result<void>> {
    const r = await tx
      .update(items)
      .set({ ...set, version: version + 1, updatedAt: audit.at, updatedBy: audit.by })
      .where(and(eq(items.id, id), eq(items.version, version)))
      .returning({ id: items.id });
    if (r.length) return ok(undefined);
    const exists = await tx.select({ id: items.id }).from(items).where(eq(items.id, id));
    return exists.length ? err("STALE_RECORD") : err("NOT_FOUND");
  }

  const repo: ItemRepo = {
    async takeNextItemSeq(subgroupId) {
      const [r] = await tx
        .update(itemSubgroups)
        .set({ nextItemSeq: sql`${itemSubgroups.nextItemSeq} + 1` })
        .where(eq(itemSubgroups.id, subgroupId))
        .returning({ taken: sql<number>`${itemSubgroups.nextItemSeq} - 1` });
      return r!.taken;
    },

    insert: (item, audit) =>
      guarded(
        async () => {
          await tx.insert(items).values({
            id: item.id,
            restaurantId,
            code: item.code,
            ...toRow(item),
            createdAt: audit.at,
            createdBy: audit.by,
            updatedAt: audit.at,
            updatedBy: audit.by,
          });
          await writeConversions(item.id, item, audit);
          return ok(undefined);
        },
        item.subgroupId,
        item.descriptionNormalized,
      ),

    update: (id, data, version, audit) =>
      guarded(
        async () => {
          const r = await optimistic(id, version, toRow(data), audit);
          if (!r.ok) return r;
          await writeConversions(id, data, audit);
          return ok(undefined);
        },
        data.subgroupId,
        data.descriptionNormalized,
        id,
      ),

    async get(id) {
      const [row] = await tx
        .select({ i: items, s: itemSubgroups, g: itemGroups })
        .from(items)
        .innerJoin(itemSubgroups, eq(itemSubgroups.id, items.subgroupId))
        .innerJoin(itemGroups, eq(itemGroups.id, itemSubgroups.groupId))
        .where(eq(items.id, id));
      if (!row) return null;
      const conv = await tx
        .select()
        .from(itemUnitConversions)
        .where(eq(itemUnitConversions.itemId, id))
        .orderBy(asc(itemUnitConversions.createdAt));
      const i = row.i;
      const item: Item = {
        id: i.id,
        code: i.code,
        description: i.description,
        type: i.type,
        subgroupId: i.subgroupId,
        stockUnit: UNIT_CODE_BY_ID[i.stockUnitId]!,
        recipeUnit: UNIT_CODE_BY_ID[i.recipeUnitId]!,
        purchaseUnitLabel: i.purchaseUnitLabel,
        purchaseFactor: d(i.purchaseFactor),
        conversions: conv.map((c) => ({
          fromUnit: UNIT_CODE_BY_ID[c.fromUnitId]!,
          toUnit: UNIT_CODE_BY_ID[c.toUnitId]!,
          factor: d(c.factor),
        })),
        eanUnit: i.eanUnit,
        eanPackage: i.eanPackage,
        noGtin: i.noGtin,
        financialCategory: i.financialCategory,
        presentation: i.presentation,
        netWeight: dec(i.netWeight),
        drainedWeight: dec(i.drainedWeight),
        catchWeight: i.catchWeight,
        correctionFactor: d(i.correctionFactor),
        yieldFactor: dec(i.yieldFactor),
        storageTempMaxC: dec(i.storageTempMaxC),
        receivingTempMinC: dec(i.receivingTempMinC),
        receivingTempMaxC: dec(i.receivingTempMaxC),
        shelfLifeDays: i.shelfLifeDays,
        openedLifeDays: i.openedLifeDays,
        lotControl: i.lotControl,
        expiryAlertDays: i.expiryAlertDays,
        allergens: i.allergens as Allergen[],
        ncm: i.ncm,
        cest: i.cest,
        origin: i.origin,
        taxGroup: i.taxGroup,
        countable: i.countable,
        countFrequency: i.countFrequency,
        active: i.active,
        version: i.version,
        inCogsOverride: i.inCogsOverride,
        stockUnitLockedAt: i.stockUnitLockedAt,
        averageCost: dec(i.averageCost),
        lastCost: dec(i.lastCost),
        costUpdatedAt: i.costUpdatedAt,
        abcClass: i.abcClass,
        groupId: row.g.id,
        groupName: row.g.name,
        subgroupName: row.s.name,
        storageClass: row.g.storageClass,
        groupInCogs: row.g.inCogs,
      };
      return item;
    },

    async list(f) {
      const where: SQL[] = [];
      if (f.status !== "all") where.push(eq(items.active, f.status !== "inactive"));
      if (f.groupId) where.push(eq(itemSubgroups.groupId, f.groupId));
      if (f.subgroupId) where.push(eq(items.subgroupId, f.subgroupId));
      if (f.type) where.push(eq(items.type, f.type));
      if (f.locationId)
        where.push(
          sql`exists (select 1 from item_locations il where il.item_id = "items"."id" and il.location_id = ${f.locationId})`,
        );
      const q = f.q?.trim();
      if (q) {
        const norm = normalizeDescription(q).replace(/[%_\\]/g, "\\$&");
        where.push(
          or(
            ilike(items.descriptionNormalized, `%${norm}%`),
            ilike(items.code, `${q.replace(/[%_\\]/g, "\\$&")}%`),
            eq(items.eanUnit, q),
            eq(items.eanPackage, q),
          )!,
        );
      }
      const cond = where.length ? and(...where) : undefined;
      const base = tx
        .select({
          id: items.id,
          code: items.code,
          description: items.description,
          type: items.type,
          active: items.active,
          stockUnitId: items.stockUnitId,
          recipeUnitId: items.recipeUnitId,
          purchaseUnitLabel: items.purchaseUnitLabel,
          purchaseFactor: items.purchaseFactor,
          groupName: itemGroups.name,
          subgroupName: itemSubgroups.name,
        })
        .from(items)
        .innerJoin(itemSubgroups, eq(itemSubgroups.id, items.subgroupId))
        .innerJoin(itemGroups, eq(itemGroups.id, itemSubgroups.groupId))
        .where(cond);
      const rows = await base
        .orderBy(asc(items.code))
        .limit(f.pageSize)
        .offset((f.page - 1) * f.pageSize);
      const [count] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(items)
        .innerJoin(itemSubgroups, eq(itemSubgroups.id, items.subgroupId))
        .where(cond);
      return {
        total: count?.n ?? 0,
        rows: rows.map((r): ItemListRow => ({
          id: r.id,
          code: r.code,
          description: r.description,
          type: r.type,
          active: r.active,
          stockUnit: UNIT_CODE_BY_ID[r.stockUnitId]!,
          recipeUnit: UNIT_CODE_BY_ID[r.recipeUnitId]!,
          purchaseUnitLabel: r.purchaseUnitLabel,
          purchaseFactor: d(r.purchaseFactor),
          groupName: r.groupName,
          subgroupName: r.subgroupName,
        })),
      };
    },

    async findActiveByDescription(subgroupId, normalized, exceptId) {
      const [r] = await tx
        .select({ id: items.id, code: items.code })
        .from(items)
        .where(
          and(
            eq(items.subgroupId, subgroupId),
            eq(items.descriptionNormalized, normalized),
            eq(items.active, true),
            exceptId ? ne(items.id, exceptId) : undefined,
          ),
        );
      return r ?? null;
    },

    async setActive(id, active, version, audit) {
      const [cur] = await tx
        .select({ s: items.subgroupId, n: items.descriptionNormalized })
        .from(items)
        .where(eq(items.id, id));
      if (!cur) return err("NOT_FOUND");
      return guarded(() => optimistic(id, version, { active }, audit), cur.s, cur.n, id);
    },

    setCogsOverride: (id, value, version, audit) => optimistic(id, version, { inCogsOverride: value }, audit),

    async activeCountInSubgroup(subgroupId) {
      const [r] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(items)
        .where(and(eq(items.subgroupId, subgroupId), eq(items.active, true)));
      return r?.n ?? 0;
    },
  };
  return repo;
}

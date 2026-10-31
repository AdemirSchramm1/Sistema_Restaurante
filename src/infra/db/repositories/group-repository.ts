import { and, asc, eq, sql } from "drizzle-orm";
import type { GroupRecord, GroupRepo, SubgroupRecord } from "@/application/inventory/ports";
import { err, ok, type Result } from "@/domain/shared/result";
import type { Tx } from "../db";
import { itemGroups, itemSubgroups, items, restaurants } from "../schema";
import { isUniqueViolation } from "./util";

const groupCols = {
  id: itemGroups.id,
  code: itemGroups.code,
  name: itemGroups.name,
  storageClass: itemGroups.storageClass,
  inCogs: itemGroups.inCogs,
  isSystem: itemGroups.isSystem,
  active: itemGroups.active,
  version: itemGroups.version,
};

const subgroupCols = {
  id: itemSubgroups.id,
  groupId: itemSubgroups.groupId,
  code: itemSubgroups.code,
  name: itemSubgroups.name,
  active: itemSubgroups.active,
  version: itemSubgroups.version,
  activeItems: sql<number>`(select count(*)::int from ${items} where ${items.subgroupId} = ${itemSubgroups.id} and ${items.active})`,
};

export function groupRepository(tx: Tx, restaurantId: string): GroupRepo {
  async function optimistic(
    table: typeof itemGroups | typeof itemSubgroups,
    id: string,
    version: number,
    set: Record<string, unknown>,
    audit: { at: Date; by: string | null },
    nameConstraint: string,
  ): Promise<Result<void>> {
    try {
      const r = await tx
        .update(table)
        .set({ ...set, version: version + 1, updatedAt: audit.at, updatedBy: audit.by })
        .where(and(eq(table.id, id), eq(table.version, version)))
        .returning({ id: table.id });
      if (r.length > 0) return ok(undefined);
      const exists = await tx.select({ id: table.id }).from(table).where(eq(table.id, id));
      return exists.length ? err("STALE_RECORD") : err("NOT_FOUND");
    } catch (e) {
      if (isUniqueViolation(e, nameConstraint)) return err("NAME_IN_USE", "name");
      throw e;
    }
  }

  return {
    async seedDefaultTree(tree, ids, audit) {
      for (const g of tree) {
        const groupId = ids();
        await tx.insert(itemGroups).values({
          id: groupId,
          restaurantId,
          code: g.code,
          name: g.name,
          storageClass: g.storageClass,
          inCogs: g.inCogs,
          isSystem: true,
          nextSubgroupCode: g.subgroups.length + 1,
          createdAt: audit.at,
          createdBy: audit.by,
          updatedAt: audit.at,
          updatedBy: audit.by,
        });
        await tx.insert(itemSubgroups).values(
          g.subgroups.map((s) => ({
            id: ids(),
            restaurantId,
            groupId,
            code: s.code,
            name: s.name,
            createdAt: audit.at,
            createdBy: audit.by,
            updatedAt: audit.at,
            updatedBy: audit.by,
          })),
        );
      }
    },

    async tree(includeInactive) {
      const groups = await tx
        .select(groupCols)
        .from(itemGroups)
        .where(includeInactive ? undefined : eq(itemGroups.active, true))
        .orderBy(asc(itemGroups.code));
      const subs = await tx
        .select(subgroupCols)
        .from(itemSubgroups)
        .where(includeInactive ? undefined : eq(itemSubgroups.active, true))
        .orderBy(asc(itemSubgroups.code));
      return groups.map((g) => ({ ...g, subgroups: subs.filter((s) => s.groupId === g.id) }));
    },

    async getGroup(id) {
      const [g] = await tx.select(groupCols).from(itemGroups).where(eq(itemGroups.id, id));
      return g ?? null;
    },

    async getSubgroup(id) {
      const [row] = await tx
        .select({ s: subgroupCols, g: groupCols })
        .from(itemSubgroups)
        .innerJoin(itemGroups, eq(itemGroups.id, itemSubgroups.groupId))
        .where(eq(itemSubgroups.id, id));
      return row ? { ...(row.s as SubgroupRecord), group: row.g as GroupRecord } : null;
    },

    async takeNextGroupCode() {
      const [r] = await tx
        .update(restaurants)
        .set({ nextGroupCode: sql`${restaurants.nextGroupCode} + 1` })
        .where(eq(restaurants.id, restaurantId))
        .returning({ taken: sql<number>`${restaurants.nextGroupCode} - 1` });
      return r!.taken;
    },

    async takeNextSubgroupCode(groupId) {
      const [r] = await tx
        .update(itemGroups)
        .set({ nextSubgroupCode: sql`${itemGroups.nextSubgroupCode} + 1` })
        .where(eq(itemGroups.id, groupId))
        .returning({ taken: sql<number>`${itemGroups.nextSubgroupCode} - 1` });
      return r!.taken;
    },

    async insertGroup(g, audit) {
      try {
        await tx.insert(itemGroups).values({
          ...g,
          restaurantId,
          createdAt: audit.at,
          createdBy: audit.by,
          updatedAt: audit.at,
          updatedBy: audit.by,
        });
        return ok(undefined);
      } catch (e) {
        if (isUniqueViolation(e, "item_groups_active_name")) return err("NAME_IN_USE", "name");
        throw e;
      }
    },

    async insertSubgroup(s, audit) {
      try {
        await tx.insert(itemSubgroups).values({
          ...s,
          restaurantId,
          createdAt: audit.at,
          createdBy: audit.by,
          updatedAt: audit.at,
          updatedBy: audit.by,
        });
        return ok(undefined);
      } catch (e) {
        if (isUniqueViolation(e, "item_subgroups_active_name")) return err("NAME_IN_USE", "name");
        throw e;
      }
    },

    renameGroup: (id, name, version, audit) =>
      optimistic(itemGroups, id, version, { name }, audit, "item_groups_active_name"),
    renameSubgroup: (id, name, version, audit) =>
      optimistic(itemSubgroups, id, version, { name }, audit, "item_subgroups_active_name"),
    setGroupActive: (id, active, version, audit) =>
      optimistic(itemGroups, id, version, { active }, audit, "item_groups_active_name"),
    setSubgroupActive: (id, active, version, audit) =>
      optimistic(itemSubgroups, id, version, { active }, audit, "item_subgroups_active_name"),
  };
}

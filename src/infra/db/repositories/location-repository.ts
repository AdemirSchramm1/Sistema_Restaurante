import { and, asc, eq, sql } from "drizzle-orm";
import type { LocationRepo } from "@/application/inventory/ports";
import type { Location, LocationData } from "@/domain/inventory/location";
import { err, ok, type Result } from "@/domain/shared/result";
import type { Tx } from "../db";
import { itemLocations, locations } from "../schema";
import { dec, isUniqueViolation, str, withSavepoint } from "./util";

type Row = typeof locations.$inferSelect;
const toLocation = (r: Row): Location => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  tempMinC: dec(r.tempMinC),
  tempMaxC: dec(r.tempMaxC),
  responsibleUserId: r.responsibleUserId,
  countOrder: r.countOrder,
  isSystem: r.isSystem,
  active: r.active,
  version: r.version,
});
const toRow = (l: LocationData) => ({
  name: l.name.trim(),
  kind: l.kind,
  tempMinC: str(l.tempMinC),
  tempMaxC: str(l.tempMaxC),
  responsibleUserId: l.responsibleUserId,
  countOrder: l.countOrder,
});

export function locationRepository(tx: Tx, restaurantId: string): LocationRepo {
  async function guarded(fn: () => Promise<Result<void>>): Promise<Result<void>> {
    try {
      return await withSavepoint(tx, fn);
    } catch (e) {
      if (isUniqueViolation(e, "locations_active_name")) return err("NAME_IN_USE", "name");
      throw e;
    }
  }
  async function optimistic(
    id: string,
    version: number,
    set: Record<string, unknown>,
    audit: { at: Date; by: string | null },
  ) {
    return guarded(async () => {
      const r = await tx
        .update(locations)
        .set({ ...set, version: version + 1, updatedAt: audit.at, updatedBy: audit.by })
        .where(and(eq(locations.id, id), eq(locations.version, version)))
        .returning({ id: locations.id });
      if (r.length) return ok(undefined);
      const exists = await tx.select({ id: locations.id }).from(locations).where(eq(locations.id, id));
      return exists.length ? err("STALE_RECORD") : err("NOT_FOUND");
    });
  }

  return {
    insert: (l, audit) =>
      guarded(async () => {
        await tx.insert(locations).values({
          id: l.id,
          restaurantId,
          ...toRow(l),
          isSystem: l.isSystem,
          createdAt: audit.at,
          createdBy: audit.by,
          updatedAt: audit.at,
          updatedBy: audit.by,
        });
        return ok(undefined);
      }),
    update: (id, l, version, audit) => optimistic(id, version, toRow(l), audit),
    async get(id) {
      const [r] = await tx.select().from(locations).where(eq(locations.id, id));
      return r ? toLocation(r) : null;
    },
    async list(includeInactive) {
      const rows = await tx
        .select()
        .from(locations)
        .where(includeInactive ? undefined : eq(locations.active, true))
        .orderBy(asc(locations.countOrder), asc(locations.name));
      return rows.map(toLocation);
    },
    setActive: (id, active, version, audit) => optimistic(id, version, { active }, audit),
    async linkCount(id) {
      const [r] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(itemLocations)
        .where(eq(itemLocations.locationId, id));
      return r?.n ?? 0;
    },
  };
}

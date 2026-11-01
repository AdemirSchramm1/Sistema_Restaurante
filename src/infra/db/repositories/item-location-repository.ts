import { asc, eq } from "drizzle-orm";
import type { ItemLocationRepo } from "@/application/inventory/ports";
import { err, ok } from "@/domain/shared/result";
import type { Tx } from "../db";
import { itemLocations, locations } from "../schema";
import { isUniqueViolation, withSavepoint } from "./util";

export function itemLocationRepository(tx: Tx, restaurantId: string): ItemLocationRepo {
  return {
    async replaceForItem(itemId, links, ids, audit) {
      try {
        await withSavepoint(tx, async () => {
          await tx.delete(itemLocations).where(eq(itemLocations.itemId, itemId));
          if (links.length)
            await tx.insert(itemLocations).values(
              links.map((l) => ({
                id: ids(),
                restaurantId,
                itemId,
                locationId: l.locationId,
                isDefault: l.isDefault,
                createdAt: audit.at,
                createdBy: audit.by,
              })),
            );
        });
        return ok(undefined);
      } catch (e) {
        if (isUniqueViolation(e, "item_locations_one_default")) return err("MULTIPLE_DEFAULTS", "links");
        if (isUniqueViolation(e, "item_locations_unique"))
          return err("VALIDATION", "links", { reason: "duplicate_location" });
        throw e;
      }
    },
    async listForItem(itemId) {
      return tx
        .select({
          locationId: itemLocations.locationId,
          isDefault: itemLocations.isDefault,
          locationName: locations.name,
          kind: locations.kind,
        })
        .from(itemLocations)
        .innerJoin(locations, eq(locations.id, itemLocations.locationId))
        .where(eq(itemLocations.itemId, itemId))
        .orderBy(asc(locations.name));
    },
  };
}

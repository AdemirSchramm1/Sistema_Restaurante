import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize } from "../shared";
import type { ItemLocationLink } from "./ports";
import { effectiveInCogs, stockUnitEquivalence, type Item } from "@/domain/inventory/item";
import type { LocationKind } from "@/domain/inventory/location";
import { d, type Decimal } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";

export type ItemView = {
  item: Item;
  effectiveInCogs: boolean;
  equivalence: { purchase: Decimal; stock: Decimal; recipe: Decimal } | null;
  locations: (ItemLocationLink & { locationName: string; kind: LocationKind })[];
};

export const effectiveInCogsOf = (item: Pick<Item, "inCogsOverride" | "groupInCogs">) =>
  item.inCogsOverride ?? item.groupInCogs;

export async function getItem(deps: Deps, ctx: RequestContext, id: string): Promise<Result<ItemView>> {
  const allowed = await authorize(deps, ctx, "catalog.read", "item", id);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const item = await repos.items.get(id);
    if (!item) return err("NOT_FOUND");
    const eq = stockUnitEquivalence(item, d(1));
    return ok({
      item,
      effectiveInCogs: effectiveInCogs(item),
      equivalence: eq.ok ? eq.value : null,
      locations: await repos.itemLocations.listForItem(id),
    });
  });
}

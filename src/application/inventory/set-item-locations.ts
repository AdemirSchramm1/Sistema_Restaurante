import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import type { ItemLocationLink } from "./ports";
import { diffFields } from "@/domain/shared/audit";
import { err, ok, type Result } from "@/domain/shared/result";

/** Define onde o item fica guardado: no máximo um local principal (docs/produto/estoque/05-locais.md). */
export async function setItemLocations(
  deps: Deps,
  ctx: RequestContext,
  itemId: string,
  links: ItemLocationLink[],
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "item_location.manage", "item_location", itemId);
  if (!allowed.ok) return allowed;
  if (links.filter((l) => l.isDefault).length > 1) return err("MULTIPLE_DEFAULTS", "links");
  if (new Set(links.map((l) => l.locationId)).size !== links.length) return err("VALIDATION", "links");

  return deps.tenant(ctx.restaurantId, async (repos) => {
    const item = await repos.items.get(itemId);
    if (!item) return err("NOT_FOUND");
    for (const link of links) {
      const loc = await repos.locations.get(link.locationId);
      if (!loc) return err("NOT_FOUND", "locationId", { locationId: link.locationId });
      if (!loc.active) return err("LOCATION_INACTIVE", "locationId", { locationId: link.locationId });
    }
    const before = await repos.itemLocations.listForItem(itemId);
    const r = await repos.itemLocations.replaceForItem(
      itemId,
      links,
      () => deps.ids.next(),
      auditStamp(deps, ctx),
    );
    if (!r.ok) return r;
    const fmt = (ls: ItemLocationLink[]) =>
      [...ls]
        .sort((a, b) => a.locationId.localeCompare(b.locationId))
        .map((l) => `${l.locationId}${l.isDefault ? "*" : ""}`);
    const changes = diffFields({ locations: fmt(before) }, { locations: fmt(links) });
    if (Object.keys(changes).length)
      await repos.audit.record({
        entity: "item",
        entityId: itemId,
        action: "UPDATE",
        changes,
        userId: ctx.userId,
        origin: ctx.origin,
      });
    return ok(undefined);
  });
}

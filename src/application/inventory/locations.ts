import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import {
  orderLocations,
  validateLocation,
  type Location,
  type LocationData,
} from "@/domain/inventory/location";
import { SUGGESTED_LOCATIONS } from "@/domain/inventory/suggested-locations";
import { diffFields } from "@/domain/shared/audit";
import { err, ok, type Result } from "@/domain/shared/result";

const view = (l: LocationData) => ({ name: l.name.trim(), kind: l.kind });

export async function listLocations(
  deps: Deps,
  ctx: RequestContext,
  includeInactive = false,
): Promise<Result<Location[]>> {
  const allowed = await authorize(deps, ctx, "catalog.read", "location");
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) =>
    ok(orderLocations(await repos.locations.list(includeInactive))),
  );
}

export async function createLocation(
  deps: Deps,
  ctx: RequestContext,
  data: LocationData,
): Promise<Result<{ id: string }>> {
  const allowed = await authorize(deps, ctx, "location.manage", "location");
  if (!allowed.ok) return allowed;
  const valid = validateLocation(data);
  if (!valid.ok) return valid;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const id = deps.ids.next();
    const r = await repos.locations.insert({ ...data, id, isSystem: false }, auditStamp(deps, ctx));
    if (!r.ok) return r;
    await repos.audit.record({
      entity: "location",
      entityId: id,
      action: "CREATE",
      changes: diffFields(null, view(data)),
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok({ id });
  });
}

export async function updateLocation(
  deps: Deps,
  ctx: RequestContext,
  id: string,
  version: number,
  data: LocationData,
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "location.manage", "location", id);
  if (!allowed.ok) return allowed;
  const valid = validateLocation(data);
  if (!valid.ok) return valid;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const current = await repos.locations.get(id);
    if (!current) return err("NOT_FOUND");
    if (current.isSystem && data.kind !== current.kind) return err("SYSTEM_RECORD", "kind");
    const r = await repos.locations.update(id, data, version, auditStamp(deps, ctx));
    if (!r.ok) return r;
    const changes = diffFields(view(current), view(data));
    if (Object.keys(changes).length)
      await repos.audit.record({
        entity: "location",
        entityId: id,
        action: "UPDATE",
        changes,
        userId: ctx.userId,
        origin: ctx.origin,
      });
    return ok(undefined);
  });
}

/** Local com itens vinculados não inativa; registro de sistema (dados antigos) também não. */
export async function setLocationActive(
  deps: Deps,
  ctx: RequestContext,
  id: string,
  version: number,
  active: boolean,
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "location.manage", "location", id);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const current = await repos.locations.get(id);
    if (!current) return err("NOT_FOUND");
    if (current.isSystem && !active) return err("SYSTEM_RECORD");
    if (!active && (await repos.locations.linkCount(id)) > 0) return err("LOCATION_IN_USE");
    const r = await repos.locations.setActive(id, active, version, auditStamp(deps, ctx));
    if (!r.ok) return r;
    await repos.audit.record({
      entity: "location",
      entityId: id,
      action: active ? "REACTIVATE" : "DEACTIVATE",
      changes: { active: [!active, active] },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok(undefined);
  });
}

/** Cria os locais sugeridos escolhidos. Nome já em uso é pulado. */
export async function applySuggestedLocations(
  deps: Deps,
  ctx: RequestContext,
  keys: string[],
): Promise<Result<{ created: number }>> {
  const allowed = await authorize(deps, ctx, "location.manage", "location");
  if (!allowed.ok) return allowed;
  let created = 0;
  for (const s of SUGGESTED_LOCATIONS.filter((x) => keys.includes(x.key))) {
    const { key: _k, purpose: _p, ...data } = s;
    const r = await createLocation(deps, ctx, data);
    if (r.ok) created += 1;
    else if (r.error.code !== "NAME_IN_USE") return r;
  }
  return ok({ created });
}

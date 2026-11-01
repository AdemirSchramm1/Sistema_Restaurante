import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import { ok, type Result } from "@/domain/shared/result";

/** Inativa ou reativa item; nunca apaga (FR-027). */
export async function setItemActive(
  deps: Deps,
  ctx: RequestContext,
  id: string,
  version: number,
  active: boolean,
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "item.write", "item", id);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const r = await repos.items.setActive(id, active, version, auditStamp(deps, ctx));
    if (!r.ok) return r;
    await repos.audit.record({
      entity: "item",
      entityId: id,
      action: active ? "REACTIVATE" : "DEACTIVATE",
      changes: { active: [!active, active] },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok(undefined);
  });
}

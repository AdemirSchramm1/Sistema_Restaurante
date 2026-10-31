import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import { err, ok, type Result } from "@/domain/shared/result";

/** Sobrescreve "entra no CMV" no item; `null` volta a seguir o grupo (FR-024). Só gerente. */
export async function setItemCogsOverride(
  deps: Deps,
  ctx: RequestContext,
  id: string,
  version: number,
  value: boolean | null,
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "item.cogs_override", "item", id);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const item = await repos.items.get(id);
    if (!item) return err("NOT_FOUND");
    const r = await repos.items.setCogsOverride(id, value, version, auditStamp(deps, ctx));
    if (!r.ok) return r;
    if (item.inCogsOverride !== value)
      await repos.audit.record({
        entity: "item",
        entityId: id,
        action: "UPDATE",
        changes: { inCogsOverride: [item.inCogsOverride, value] },
        userId: ctx.userId,
        origin: ctx.origin,
      });
    return ok(undefined);
  });
}

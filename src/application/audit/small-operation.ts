import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import { err, ok, type Result } from "@/domain/shared/result";

/**
 * Modo operação pequena (spec 019, US2): com ele ligado, o gerente pode aprovar o próprio acerto de
 * estoque, que fica marcado como exceção. Só o gerente vê e muda.
 */

export async function getSmallOperation(
  deps: Deps,
  ctx: RequestContext,
): Promise<Result<{ enabled: boolean; version: number }>> {
  const allowed = await authorize(deps, ctx, "restaurant.small_operation", "restaurant", ctx.restaurantId);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => ok(await repos.restaurants.smallOperation()));
}

export async function setSmallOperation(
  deps: Deps,
  ctx: RequestContext,
  input: { enabled: boolean; version: number },
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "restaurant.small_operation", "restaurant", ctx.restaurantId);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const current = await repos.restaurants.smallOperation();
    const saved = await repos.restaurants.setSmallOperation(
      input.enabled,
      input.version,
      auditStamp(deps, ctx),
    );
    if (!saved) return err("STALE_RECORD");
    if (current.enabled !== input.enabled)
      await repos.audit.record({
        entity: "restaurant",
        entityId: ctx.restaurantId,
        action: "UPDATE",
        changes: { smallOperation: [current.enabled, input.enabled] },
        userId: ctx.userId,
        origin: ctx.origin,
      });
    return ok(undefined);
  });
}

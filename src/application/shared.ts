import type { Deps } from "./ports";
import type { RequestContext } from "./context";
import { assertCan, type Action } from "@/domain/access/permissions";
import { ok, type Result } from "@/domain/shared/result";

/** Checa a permissão; se negar, registra a tentativa na auditoria (FR-003) e devolve FORBIDDEN. */
export async function authorize(
  deps: Deps,
  ctx: RequestContext,
  action: Action,
  entity: string,
  entityId: string | null = null,
): Promise<Result<true>> {
  const allowed = assertCan(ctx.roles, action);
  if (allowed.ok) return allowed;
  await deps.tenant(ctx.restaurantId, async (repos) => {
    await repos.audit.record({
      entity,
      entityId,
      action: "DENIED",
      changes: { action },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok(undefined);
  });
  return allowed;
}

export const auditStamp = (deps: Deps, ctx: RequestContext) => ({ at: deps.clock.now(), by: ctx.userId });

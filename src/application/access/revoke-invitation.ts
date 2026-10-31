import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import { err, ok, type Result } from "@/domain/shared/result";

export async function revokeInvitation(
  deps: Deps,
  ctx: RequestContext,
  invitationId: string,
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "user.invite", "invitation", invitationId);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const inv = await repos.invitations.get(invitationId);
    if (!inv || inv.status !== "PENDING") return err("NOT_FOUND");
    if (!(await repos.invitations.setStatus(inv.id, "REVOKED", inv.version, auditStamp(deps, ctx))))
      return err("STALE_RECORD");
    await repos.audit.record({
      entity: "invitation",
      entityId: inv.id,
      action: "DEACTIVATE",
      changes: { status: ["PENDING", "REVOKED"] },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok(undefined);
  });
}

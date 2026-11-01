import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import type { InvitationRecord, MemberRecord } from "./ports";
import { assertKeepsManager, validateRoles } from "@/domain/access/memberships";
import { err, ok, type Result } from "@/domain/shared/result";

export async function listMembers(deps: Deps, ctx: RequestContext): Promise<Result<MemberRecord[]>> {
  const allowed = await authorize(deps, ctx, "user.manage", "membership");
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => ok(await repos.members.list()));
}

export async function listPendingInvitations(
  deps: Deps,
  ctx: RequestContext,
): Promise<Result<Omit<InvitationRecord, "tokenHash">[]>> {
  const allowed = await authorize(deps, ctx, "user.invite", "invitation");
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) =>
    ok((await repos.invitations.listPending()).map(({ tokenHash: _t, ...i }) => i)),
  );
}

/** Troca os papéis de um membro; sempre fica pelo menos um gerente ativo. */
export async function setMemberRoles(
  deps: Deps,
  ctx: RequestContext,
  membershipId: string,
  version: number,
  rawRoles: string[],
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "user.manage", "membership", membershipId);
  if (!allowed.ok) return allowed;
  const roles = validateRoles(rawRoles);
  if (!roles.ok) return roles;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const all = await repos.members.list();
    const target = all.find((m) => m.membershipId === membershipId);
    if (!target) return err("NOT_FOUND");
    const keeps = assertKeepsManager(all, { ...target, roles: roles.value });
    if (!keeps.ok) return keeps;
    if (!(await repos.members.setRoles(membershipId, roles.value, version, auditStamp(deps, ctx))))
      return err("STALE_RECORD");
    const before = [...target.roles].sort();
    const after = [...roles.value].sort();
    if (before.join() !== after.join())
      await repos.audit.record({
        entity: "membership",
        entityId: membershipId,
        action: "UPDATE",
        changes: { roles: [before, after] },
        userId: ctx.userId,
        origin: ctx.origin,
      });
    return ok(undefined);
  });
}

/** Desativa ou reativa um membro. Desativado perde o acesso na hora; o histórico fica. */
export async function setMemberActive(
  deps: Deps,
  ctx: RequestContext,
  membershipId: string,
  version: number,
  active: boolean,
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "user.manage", "membership", membershipId);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const all = await repos.members.list();
    const target = all.find((m) => m.membershipId === membershipId);
    if (!target) return err("NOT_FOUND");
    const keeps = assertKeepsManager(all, { ...target, active });
    if (!keeps.ok) return keeps;
    if (!(await repos.members.setActive(membershipId, active, version, auditStamp(deps, ctx))))
      return err("STALE_RECORD");
    if (target.active !== active)
      await repos.audit.record({
        entity: "membership",
        entityId: membershipId,
        action: active ? "REACTIVATE" : "DEACTIVATE",
        changes: { active: [target.active, active] },
        userId: ctx.userId,
        origin: ctx.origin,
      });
    return ok(undefined);
  });
}

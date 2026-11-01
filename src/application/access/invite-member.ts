import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import { invitationEmail } from "./invitation-email";
import { invitationExpiresAt, normalizeEmail } from "@/domain/access/invitation";
import { validateRoles } from "@/domain/access/memberships";
import { err, ok, type Result } from "@/domain/shared/result";

/** Convida alguém por e-mail para a equipe, com os papéis dados (FR-002). */
export async function inviteMember(
  deps: Deps,
  ctx: RequestContext,
  input: { email: string; roles: string[] },
): Promise<Result<{ invitationId: string }>> {
  const allowed = await authorize(deps, ctx, "user.invite", "invitation");
  if (!allowed.ok) return allowed;
  const email = normalizeEmail(input.email);
  if (!email.ok) return email;
  const roles = validateRoles(input.roles);
  if (!roles.ok) return roles;

  const existingUser = await deps.global.userIdByEmail(email.value);
  if (existingUser) {
    const m = await deps.global.membershipForUser(existingUser);
    if (m?.restaurantId === ctx.restaurantId) return err("ALREADY_MEMBER", "email");
    if (m) return err("EMAIL_BELONGS_TO_OTHER_RESTAURANT", "email");
    return err("EMAIL_IN_USE", "email");
  }

  return deps.tenant(ctx.restaurantId, async (repos) => {
    const now = deps.clock.now();
    const pending = await repos.invitations.findPendingByEmail(email.value);
    if (pending) {
      if (pending.expiresAt.getTime() >= now.getTime()) return err("INVITATION_PENDING", "email");
      await repos.invitations.setStatus(pending.id, "EXPIRED", pending.version, auditStamp(deps, ctx));
    }
    const restaurant = await repos.restaurants.get();
    const { token, hash } = deps.tokens.create();
    const id = deps.ids.next();
    await repos.invitations.create(
      { id, email: email.value, roles: roles.value, tokenHash: hash, expiresAt: invitationExpiresAt(now) },
      auditStamp(deps, ctx),
    );
    await repos.audit.record({
      entity: "invitation",
      entityId: id,
      action: "CREATE",
      changes: { email: [null, email.value], roles: [null, [...roles.value].sort()] },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    await deps.mailer.send(
      invitationEmail({
        to: email.value,
        restaurantName: restaurant?.name ?? "restaurante",
        roles: roles.value,
        link: `${deps.appUrl}/convite/${token}`,
      }),
    );
    return ok({ invitationId: id });
  });
}

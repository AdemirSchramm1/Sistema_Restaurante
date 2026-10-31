import type { Deps } from "../ports";
import type { Origin } from "../context";
import { checkInvitationUsable } from "@/domain/access/invitation";
import { err, ok, type Result } from "@/domain/shared/result";
import type { InvitationRecord } from "./ports";

export type AcceptInput = { token: string; name: string; password: string };

async function findUsable(
  deps: Deps,
  token: string,
): Promise<Result<{ restaurantId: string; invitation: InvitationRecord }>> {
  const found = await deps.global.invitationByTokenHash(deps.tokens.hash(token));
  if (!found) return err("INVITATION_INVALID");
  return deps.tenant(found.restaurantId, async (repos) => {
    const invitation = await repos.invitations.get(found.invitationId);
    if (!invitation) return err("INVITATION_INVALID");
    const usable = checkInvitationUsable(invitation, deps.clock.now());
    if (!usable.ok) return usable;
    return ok({ restaurantId: found.restaurantId, invitation });
  });
}

/** Mostra o convite para a tela de aceite (sem login). */
export async function peekInvitation(
  deps: Deps,
  token: string,
): Promise<Result<{ email: string; restaurantName: string }>> {
  const r = await findUsable(deps, token);
  if (!r.ok) return r;
  return deps.tenant(r.value.restaurantId, async (repos) =>
    ok({ email: r.value.invitation.email, restaurantName: (await repos.restaurants.get())?.name ?? "" }),
  );
}

/** Aceita o convite: cria o login e o vínculo com os papéis do convite (FR-002). Rota pública. */
export async function acceptInvitation(
  deps: Deps,
  input: AcceptInput,
  origin: Origin,
): Promise<Result<{ userId: string }>> {
  const name = input.name.trim();
  if (name.length < 2) return err("VALIDATION", "name");
  if (input.password.length < 8) return err("WEAK_PASSWORD", "password");
  const found = await findUsable(deps, input.token);
  if (!found.ok) return found;
  const { restaurantId, invitation } = found.value;

  const created = await deps.auth.createUser({ email: invitation.email, password: input.password, name });
  if (!created.ok) return created;
  const { userId } = created.value;
  const audit = { at: deps.clock.now(), by: userId };
  const membershipId = deps.ids.next();
  try {
    const r = await deps.tenant(restaurantId, async (repos) => {
      const accepted = await repos.invitations.setStatus(
        invitation.id,
        "ACCEPTED",
        invitation.version,
        audit,
      );
      if (!accepted) return err("INVITATION_INVALID");
      await repos.members.create({ id: membershipId, userId, roles: invitation.roles }, audit);
      await repos.audit.record({
        entity: "membership",
        entityId: membershipId,
        action: "CREATE",
        changes: {
          userId: [null, userId],
          roles: [null, [...invitation.roles].sort()],
          invitationId: [null, invitation.id],
        },
        userId,
        origin,
      });
      return ok({ userId });
    });
    if (!r.ok) await deps.auth.deleteUser(userId);
    return r;
  } catch (e) {
    await deps.auth.deleteUser(userId);
    throw e;
  }
}

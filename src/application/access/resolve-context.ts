import type { Deps } from "../ports";
import type { Origin, RequestContext } from "../context";
import { ok } from "@/domain/shared/result";

/** Monta o contexto da requisição a partir do usuário autenticado. Membro desativado ou sem restaurante → null. */
export async function resolveContext(
  deps: Deps,
  userId: string,
  origin: Origin,
): Promise<RequestContext | null> {
  const m = await deps.global.membershipForUser(userId);
  if (!m || !m.active) return null;
  const r = await deps.tenant(m.restaurantId, async (repos) => ok(await repos.members.get(m.membershipId)));
  if (!r.ok || !r.value || !r.value.active) return null;
  return { userId, restaurantId: m.restaurantId, membershipId: m.membershipId, roles: r.value.roles, origin };
}

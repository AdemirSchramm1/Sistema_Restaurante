import type { Deps } from "../ports";
import type { Origin, RequestContext } from "../context";

/**
 * Monta o contexto da requisição a partir do usuário autenticado, numa consulta só (spec 012, R4).
 * Membro desativado ou sem restaurante → null.
 */
export async function resolveContext(
  deps: Deps,
  userId: string,
  origin: Origin,
): Promise<RequestContext | null> {
  const m = await deps.global.membershipForUser(userId);
  if (!m || !m.active) return null;
  return { userId, restaurantId: m.restaurantId, membershipId: m.membershipId, roles: m.roles, origin };
}

import type { Deps } from "../ports";
import type { Origin } from "../context";
import { err, ok, type Result } from "@/domain/shared/result";
import { DEFAULT_GROUP_TREE, NEXT_GROUP_CODE_AFTER_DEFAULT } from "@/domain/inventory/default-tree";
import { QUARANTINE_LOCATION_NAME } from "@/domain/inventory/location";

export type SignUpInput = { restaurantName: string; userName: string; email: string; password: string };
export type SignUpOutput = { restaurantId: string; userId: string; membershipId: string };

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/** Cria a conta do restaurante: login do gerente, restaurante, árvore padrão e quarentena (US5.1, FR-008, FR-014). */
export async function signUpRestaurant(
  deps: Deps,
  input: SignUpInput,
  origin: Origin,
): Promise<Result<SignUpOutput>> {
  const restaurantName = input.restaurantName.trim();
  const userName = input.userName.trim();
  if (restaurantName.length < 2 || restaurantName.length > 120) return err("VALIDATION", "restaurantName");
  if (userName.length < 2) return err("VALIDATION", "userName");
  if (input.password.length < 8) return err("WEAK_PASSWORD", "password");

  const created = await deps.auth.createUser({
    email: input.email,
    password: input.password,
    name: userName,
  });
  if (!created.ok) return created;
  const { userId } = created.value;

  const restaurantId = deps.ids.next();
  const membershipId = deps.ids.next();
  const audit = { at: deps.clock.now(), by: userId };

  try {
    const r = await deps.tenant(restaurantId, async (repos) => {
      await repos.restaurants.create(
        {
          id: restaurantId,
          name: restaurantName,
          timezone: DEFAULT_TIMEZONE,
          nextGroupCode: NEXT_GROUP_CODE_AFTER_DEFAULT,
        },
        audit,
      );
      await repos.members.create({ id: membershipId, userId, roles: ["MANAGER"] }, audit);
      await repos.groups.seedDefaultTree(DEFAULT_GROUP_TREE, () => deps.ids.next(), audit);
      const quarantineId = deps.ids.next();
      const q = await repos.locations.insert(
        {
          id: quarantineId,
          name: QUARANTINE_LOCATION_NAME,
          kind: "QUARANTINE",
          tempMinC: null,
          tempMaxC: null,
          responsibleUserId: userId,
          countOrder: 0,
          isSystem: true,
        },
        audit,
      );
      if (!q.ok) return q;
      await repos.audit.record({
        entity: "restaurant",
        entityId: restaurantId,
        action: "CREATE",
        changes: { name: [null, restaurantName] },
        userId,
        origin,
      });
      return ok({ restaurantId, userId, membershipId });
    });
    if (!r.ok) await deps.auth.deleteUser(userId);
    return r;
  } catch (e) {
    await deps.auth.deleteUser(userId);
    throw e;
  }
}

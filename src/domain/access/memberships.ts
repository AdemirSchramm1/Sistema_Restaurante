import { err, ok, type Result } from "../shared/result";
import { ROLES, type Role } from "./permissions";

type MemberState = { membershipId: string; roles: readonly Role[]; active: boolean };

/** O restaurante precisa manter pelo menos um gerente ativo (FR-002). */
export function assertKeepsManager(members: readonly MemberState[], change: MemberState): Result<void> {
  const after = members.map((m) => (m.membershipId === change.membershipId ? change : m));
  const managers = after.filter((m) => m.active && m.roles.includes("MANAGER"));
  return managers.length > 0 ? ok(undefined) : err("LAST_MANAGER");
}

/** Pelo menos um papel, todos conhecidos; repetidos são removidos. */
export function validateRoles(roles: readonly string[]): Result<Role[]> {
  const unique = [...new Set(roles)];
  if (unique.length === 0 || unique.some((r) => !(ROLES as readonly string[]).includes(r)))
    return err("VALIDATION", "roles");
  return ok(unique as Role[]);
}

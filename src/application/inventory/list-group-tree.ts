import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize } from "../shared";
import type { GroupTree } from "./ports";
import { ok, type Result } from "@/domain/shared/result";

export async function listGroupTree(
  deps: Deps,
  ctx: RequestContext,
  includeInactive = false,
): Promise<Result<GroupTree>> {
  const allowed = await authorize(deps, ctx, "catalog.read", "item_group");
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => ok(await repos.groups.tree(includeInactive)));
}

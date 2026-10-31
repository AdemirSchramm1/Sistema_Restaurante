import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize } from "../shared";
import type { ItemFilter, ItemListRow } from "./ports";
import { ok, type Result } from "@/domain/shared/result";

export const ITEMS_PAGE_SIZE = 50;

export async function listItems(
  deps: Deps,
  ctx: RequestContext,
  filter: Partial<Omit<ItemFilter, "pageSize">> & { page: number },
): Promise<Result<{ rows: ItemListRow[]; total: number; page: number; pageSize: number }>> {
  const allowed = await authorize(deps, ctx, "catalog.read", "item");
  if (!allowed.ok) return allowed;
  const page = Math.max(1, Math.floor(filter.page) || 1);
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const r = await repos.items.list({
      ...filter,
      status: filter.status ?? "active",
      page,
      pageSize: ITEMS_PAGE_SIZE,
    });
    return ok({ ...r, page, pageSize: ITEMS_PAGE_SIZE });
  });
}

import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize } from "../shared";
import { describePurchase, effectiveInCogs, type Item } from "@/domain/inventory/item";
import { err, ok, type Result } from "@/domain/shared/result";
import type { Decimal } from "@/domain/shared/decimal";

export type ItemView = {
  item: Item;
  effectiveInCogs: boolean;
  /** "1 Caixa = 20 kg", ou null quando o item é comprado solto. */
  purchaseSummary: string | null;
  /** Saldo na medida do item. */
  balance: Decimal;
};

export const effectiveInCogsOf = (item: Pick<Item, "inCogsOverride" | "groupInCogs">) =>
  item.inCogsOverride ?? item.groupInCogs;

export async function getItem(deps: Deps, ctx: RequestContext, id: string): Promise<Result<ItemView>> {
  const allowed = await authorize(deps, ctx, "catalog.read", "item", id);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const item = await repos.items.get(id);
    if (!item) return err("NOT_FOUND");
    return ok({
      item,
      effectiveInCogs: effectiveInCogs(item),
      purchaseSummary: describePurchase(item),
      balance: await repos.items.balance(id),
    });
  });
}

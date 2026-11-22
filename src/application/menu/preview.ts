import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { customerMenu, type MenuProduct } from "../ordering/menu";
import { withMenuAccess } from "./shared";
import type { Appearance } from "./ports";
import type { CustomerMenu } from "@/domain/menu/customer-menu";
import { businessDay } from "@/domain/ordering/business-day";
import { ok, type Result } from "@/domain/shared/result";

/**
 * "Ver como o cliente" (spec 013, US5): o mesmo cardápio que o cliente recebe agora, montado pela
 * mesma função. Só lê: não abre acesso de mesa, não conta pedido e não grava nada.
 */
export type MenuPreview = CustomerMenu<MenuProduct> & { restaurantName: string; appearance: Appearance };

export function getMenuPreview(deps: Deps, ctx: RequestContext): Promise<Result<MenuPreview>> {
  return withMenuAccess(deps, ctx, { entity: "menu" }, async (repos) => {
    const { timezone, restaurantName, appearance } = await repos.orderingSettings.get();
    const menu = await customerMenu(repos, businessDay(deps.clock.now(), timezone));
    return ok({ ...menu, restaurantName, appearance });
  });
}

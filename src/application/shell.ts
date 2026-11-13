import type { Deps } from "./ports";
import type { RequestContext } from "./context";
import { can } from "@/domain/access/permissions";
import { err, ok, type Result } from "@/domain/shared/result";

/** O que o casco de toda tela da equipe mostra: nome do restaurante e número do Repor. */
export type ShellInfo = { restaurantName: string; reorderCount: number | null };

/**
 * Cabeçalho da tela numa transação só (spec 012, R5). Quem não vê o estoque não conta o Repor
 * (nem gera tentativa negada a cada tela).
 */
export async function getShellInfo(deps: Deps, ctx: RequestContext): Promise<Result<ShellInfo>> {
  const countsReorder = can(ctx.roles, "catalog.read");
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const restaurant = await repos.restaurants.get();
    if (!restaurant) return err("NOT_FOUND");
    const reorderCount = countsReorder ? await repos.reports.countAtReorderPoint() : null;
    return ok({ restaurantName: restaurant.name, reorderCount });
  });
}

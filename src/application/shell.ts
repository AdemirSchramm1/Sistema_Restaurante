import type { Deps } from "./ports";
import type { RequestContext } from "./context";
import { can } from "@/domain/access/permissions";
import { err, ok, type Result } from "@/domain/shared/result";
import { businessDay } from "@/domain/ordering/business-day";
import { weekStartOf } from "@/domain/audit/week";

/**
 * O que o casco de toda tela da equipe mostra: nome do restaurante, número do Repor e, para o
 * gerente, as semanas com exceção da operação pequena para revisar (spec 019, US3).
 */
export type ShellInfo = {
  restaurantName: string;
  reorderCount: number | null;
  pendingReviewWeeks: string[] | null;
};

/**
 * Cabeçalho da tela numa transação só (spec 012, R5). Quem não vê o estoque não conta o Repor
 * (nem gera tentativa negada a cada tela).
 */
export async function getShellInfo(deps: Deps, ctx: RequestContext): Promise<Result<ShellInfo>> {
  const countsReorder = can(ctx.roles, "catalog.read");
  const seesReviews = can(ctx.roles, "audit.read");
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const restaurant = await repos.restaurants.get();
    if (!restaurant) return err("NOT_FOUND");
    const reorderCount = countsReorder ? await repos.reports.countAtReorderPoint() : null;
    const pendingReviewWeeks = seesReviews
      ? await repos.exceptionReviews.pendingWeeks(
          weekStartOf(businessDay(deps.clock.now(), restaurant.timezone)),
        )
      : null;
    return ok({ restaurantName: restaurant.name, reorderCount, pendingReviewWeeks });
  });
}

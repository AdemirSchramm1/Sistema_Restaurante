import type { Deps, ExceptionRow, Repos, WeekReviewRecord } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import { err, ok, type Result } from "@/domain/shared/result";
import { d } from "@/domain/shared/decimal";
import { businessDay } from "@/domain/ordering/business-day";
import { reasonById } from "@/domain/inventory/movement-reasons";
import { checkReviewNote, checkWeek, checkWeekToReview, weekEndOf, weekStartOf } from "@/domain/audit/week";

/** Revisão semanal das exceções da operação pequena (spec 019, US3). Só o gerente. */

export const REVIEW_ENTITY = "exception_review";

export type ExceptionView = Omit<ExceptionRow, "difference" | "value" | "balance" | "reasonId"> & {
  difference: string;
  value: string;
  balance: string;
  reasonLabel: string;
};

export type WeekExceptions = {
  weekStart: string;
  weekEnd: string;
  /** Já acabou (dá para marcar como revisada). */
  closed: boolean;
  review: WeekReviewRecord | null;
  exceptions: ExceptionView[];
  /** Soma dos valores, com 2 casas. */
  total: string;
};

async function today(deps: Deps, repos: Repos): Promise<string> {
  // O restaurante da sessão sempre existe (o RLS já filtrou por ele).
  const { timezone } = (await repos.restaurants.get())!;
  return businessDay(deps.clock.now(), timezone);
}

/** Semanas encerradas com exceção sem revisão, da mais antiga (uma consulta, FR-009). */
export async function pendingReviews(deps: Deps, ctx: RequestContext): Promise<Result<string[]>> {
  const allowed = await authorize(deps, ctx, "audit.read", REVIEW_ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) =>
    ok(await repos.exceptionReviews.pendingWeeks(weekStartOf(await today(deps, repos)))),
  );
}

export async function weekExceptions(
  deps: Deps,
  ctx: RequestContext,
  weekStart: string,
): Promise<Result<WeekExceptions>> {
  const allowed = await authorize(deps, ctx, "audit.read", REVIEW_ENTITY);
  if (!allowed.ok) return allowed;
  const week = checkWeek(weekStart);
  if (!week.ok) return week;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const rows = await repos.exceptionReviews.weekExceptions(weekStart);
    return ok({
      weekStart,
      weekEnd: weekEndOf(weekStart),
      closed: checkWeekToReview(weekStart, await today(deps, repos)).ok,
      review: await repos.exceptionReviews.review(weekStart),
      exceptions: rows.map(({ difference, value, balance, reasonId, ...e }) => ({
        ...e,
        difference: difference.toString(),
        value: value.toFixed(2),
        balance: balance.toString(),
        reasonLabel: reasonById(reasonId)!.label,
      })),
      total: rows.reduce((sum, e) => sum.plus(e.value), d(0)).toFixed(2),
    });
  });
}

/** Marca a semana encerrada como revisada (quem, quando e a observação), uma vez só. */
export async function markWeekReviewed(
  deps: Deps,
  ctx: RequestContext,
  input: { weekStart: string; note: string },
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "audit.read", REVIEW_ENTITY);
  if (!allowed.ok) return allowed;
  const note = checkReviewNote(input.note);
  if (!note.ok) return note;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const week = checkWeekToReview(input.weekStart, await today(deps, repos));
    if (!week.ok) return week;
    if ((await repos.exceptionReviews.weekExceptions(week.value)).length === 0) return err("NO_EXCEPTIONS");
    const id = deps.ids.next();
    const saved = await repos.exceptionReviews.insert(
      { id, weekStart: week.value, note: note.value },
      auditStamp(deps, ctx),
    );
    if (!saved) return err("ALREADY_REVIEWED");
    await repos.audit.record({
      entity: REVIEW_ENTITY,
      entityId: id,
      action: "CREATE",
      changes: { weekStart: [null, week.value], note: [null, note.value] },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok(undefined);
  });
}

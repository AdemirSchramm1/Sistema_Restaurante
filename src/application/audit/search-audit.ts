import type { AuditRow, Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize } from "../shared";
import { ok, type Result } from "@/domain/shared/result";
import { businessDay } from "@/domain/ordering/business-day";
import { AUDIT_PAGE_SIZE, readAuditFilter, type AuditFilter } from "@/domain/audit/audit-filter";
import { entitiesOf } from "@/domain/audit/operation-types";

/** Entidade das tentativas negadas de ver o relatório. */
export const AUDIT_ENTITY = "audit_log";

export type AuditReport = {
  filter: AuditFilter;
  total: number;
  rows: AuditRow[];
  timezone: string;
};

/** Relatório de auditoria (spec 019, US1): o que a equipe fez num período, só para o gerente. */
export async function searchAudit(
  deps: Deps,
  ctx: RequestContext,
  query: Record<string, string | string[] | undefined>,
): Promise<Result<AuditReport>> {
  const allowed = await authorize(deps, ctx, "audit.read", AUDIT_ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const { timezone } = (await repos.restaurants.get())!;
    const filter = readAuditFilter(query, businessDay(deps.clock.now(), timezone));
    if (!filter.ok) return filter;
    const f = filter.value;
    const found = await repos.audit.search({
      fromDay: f.from,
      toDay: f.to,
      userId: f.userId,
      entities: f.type ? entitiesOf(f.type) : null,
      deniedOnly: f.deniedOnly,
      limit: AUDIT_PAGE_SIZE,
      offset: (f.page - 1) * AUDIT_PAGE_SIZE,
    });
    return ok({ filter: f, ...found, timezone });
  });
}

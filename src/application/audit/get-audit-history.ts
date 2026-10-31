import type { AuditEntry, Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize } from "../shared";
import { ok, type Result } from "@/domain/shared/result";

export type HistoryEntry = Omit<AuditEntry, "origin"> & { occurredAt: Date; userName: string | null };

/** Histórico de um registro (FR-004). Tentativas negadas não aparecem aqui, só no relatório de auditoria. */
export async function getAuditHistory(
  deps: Deps,
  ctx: RequestContext,
  entity: string,
  entityId: string,
): Promise<Result<HistoryEntry[]>> {
  const allowed = await authorize(deps, ctx, "catalog.read", entity, entityId);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const all = await repos.audit.history(entity, entityId);
    return ok(all.filter((e) => e.action !== "DENIED").map(({ origin: _o, ...e }) => e));
  });
}

import type { Deps, Repos } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import { err, ok, type Result } from "@/domain/shared/result";

/**
 * Tablet fixo na mesa, lado da equipe (spec 016, US4; contracts "Tablet da mesa — equipe").
 * Quem pode: `table.manage` (gerente). O token do link nunca vai para a auditoria (FR-010, R14).
 */

const ENTITY = "dining_table";

export type TabletEvent = "link_created" | "bound" | "released" | "link_rotated";

export const recordTablet = (
  repos: Repos,
  tableId: string,
  event: TabletEvent,
  who: { userId: string | null; origin: RequestContext["origin"] },
) =>
  repos.audit.record({
    entity: ENTITY,
    entityId: tableId,
    action: "UPDATE",
    changes: { tablet: event },
    userId: who.userId,
    origin: who.origin,
  });

export type TabletStatusView = {
  tableId: string;
  name: string;
  version: number;
  /** `${appUrl}/t/{token}`, ou nulo antes de o gerente criar. */
  link: string | null;
  boundAt: string | null;
  lastSeenAt: string | null;
};

/** Situação dos tablets de todas as mesas ativas e quantos estão ligados (US4-8), numa consulta. */
export async function listTabletStatus(
  deps: Deps,
  ctx: RequestContext,
): Promise<Result<{ tables: TabletStatusView[]; bound: number }>> {
  const allowed = await authorize(deps, ctx, "table.manage", ENTITY);
  if (!allowed.ok) return allowed;
  const base = deps.appUrl.replace(/\/+$/, "");
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const rows = await repos.tables.tabletStatus();
    const tables = rows.map((r) => ({
      tableId: r.tableId,
      name: r.name,
      version: r.version,
      link: r.tabletToken ? `${base}/t/${r.tabletToken}` : null,
      boundAt: r.boundAt?.toISOString() ?? null,
      lastSeenAt: r.lastSeenAt?.toISOString() ?? null,
    }));
    return ok({ tables, bound: tables.filter((t) => t.boundAt).length });
  });
}

export async function createTabletLink(
  deps: Deps,
  ctx: RequestContext,
  input: { tableId: string; version: number },
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "table.manage", ENTITY, input.tableId);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const table = await repos.tables.get(input.tableId);
    if (!table) return err("NOT_FOUND");
    if (table.tabletToken) return err("NO_CHANGE");
    const r = await repos.tables.setTabletToken(
      input.tableId,
      deps.tokens.create().token,
      input.version,
      auditStamp(deps, ctx),
    );
    if (!r.ok) return r;
    await recordTablet(repos, input.tableId, "link_created", ctx);
    return ok(undefined);
  });
}

/** **Liberar**: o aparelho ligado para de funcionar e o próximo que abrir o link liga. */
export async function releaseTablet(
  deps: Deps,
  ctx: RequestContext,
  input: { tableId: string },
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "table.manage", ENTITY, input.tableId);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const open = await repos.menuAccesses.openTablet(input.tableId);
    if (!open) return err("NO_CHANGE");
    await repos.menuAccesses.end(open.id, deps.clock.now(), "RELEASED");
    await recordTablet(repos, input.tableId, "released", ctx);
    return ok(undefined);
  });
}

/** **Trocar link**: o link antigo deixa de valer e o tablet ligado é desligado, juntos. */
export async function rotateTabletLink(
  deps: Deps,
  ctx: RequestContext,
  input: { tableId: string; version: number },
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "table.manage", ENTITY, input.tableId);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const table = await repos.tables.get(input.tableId);
    if (!table?.tabletToken) return err("NOT_FOUND");
    const stamp = auditStamp(deps, ctx);
    const r = await repos.tables.setTabletToken(input.tableId, deps.tokens.create().token, input.version, stamp);
    if (!r.ok) return r;
    const open = await repos.menuAccesses.openTablet(input.tableId);
    if (open) await repos.menuAccesses.end(open.id, stamp.at, "LINK_ROTATED");
    await recordTablet(repos, input.tableId, "link_rotated", ctx);
    return ok(undefined);
  });
}

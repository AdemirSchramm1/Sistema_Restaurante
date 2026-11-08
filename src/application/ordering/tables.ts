import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import { compareTableNames, tableRange, validateTableName } from "@/domain/ordering/table-name";
import { diffFields } from "@/domain/shared/audit";
import { err, ok, type Result } from "@/domain/shared/result";

/** Mesas e QR codes (spec 009, US1). O token do link nunca vai para a auditoria. */

const ENTITY = "dining_table";

export type TableRow = { id: string; name: string; active: boolean; version: number };

export async function listTables(
  deps: Deps,
  ctx: RequestContext,
  input: { includeInactive?: boolean },
): Promise<Result<TableRow[]>> {
  const allowed = await authorize(deps, ctx, "table.manage", ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const rows = await repos.tables.list(input.includeInactive ?? false);
    return ok(rows.map(({ id, name, active, version }) => ({ id, name, active, version })));
  });
}

export async function createTable(
  deps: Deps,
  ctx: RequestContext,
  input: { name: string },
): Promise<Result<{ id: string }>> {
  const allowed = await authorize(deps, ctx, "table.manage", ENTITY);
  if (!allowed.ok) return allowed;
  const valid = validateTableName(input.name);
  if (!valid.ok) return valid;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const id = deps.ids.next();
    const inserted = await repos.tables.insert(
      { id, name: valid.value.name, normalized: valid.value.normalized, qrToken: deps.tokens.create().token },
      auditStamp(deps, ctx),
    );
    if (!inserted.ok) return inserted;
    await repos.audit.record({
      entity: ENTITY,
      entityId: id,
      action: "CREATE",
      changes: diffFields(null, { name: valid.value.name, active: true }),
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok({ id });
  });
}

/** "Criar várias mesas" de `from` a `to`; as que já existem ficam como estão. */
export async function createTablesInRange(
  deps: Deps,
  ctx: RequestContext,
  input: { from: number; to: number },
): Promise<Result<{ created: number; skipped: string[] }>> {
  const allowed = await authorize(deps, ctx, "table.manage", ENTITY);
  if (!allowed.ok) return allowed;
  const names = tableRange(input.from, input.to);
  if (!names.ok) return names;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const existing = await repos.tables.activeNames();
    const skipped: string[] = [];
    let created = 0;
    for (const raw of names.value) {
      const v = validateTableName(raw);
      if (!v.ok) return v;
      if (existing.has(v.value.normalized)) {
        skipped.push(v.value.name);
        continue;
      }
      const id = deps.ids.next();
      const inserted = await repos.tables.insert(
        { id, name: v.value.name, normalized: v.value.normalized, qrToken: deps.tokens.create().token },
        auditStamp(deps, ctx),
      );
      if (!inserted.ok) return inserted;
      await repos.audit.record({
        entity: ENTITY,
        entityId: id,
        action: "CREATE",
        changes: diffFields(null, { name: v.value.name, active: true }),
        userId: ctx.userId,
        origin: ctx.origin,
      });
      created += 1;
    }
    return ok({ created, skipped });
  });
}

export async function renameTable(
  deps: Deps,
  ctx: RequestContext,
  input: { id: string; name: string; version: number },
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "table.manage", ENTITY, input.id);
  if (!allowed.ok) return allowed;
  const valid = validateTableName(input.name);
  if (!valid.ok) return valid;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const current = await repos.tables.get(input.id);
    if (!current) return err("NOT_FOUND");
    const r = await repos.tables.rename(
      input.id,
      valid.value.name,
      valid.value.normalized,
      input.version,
      auditStamp(deps, ctx),
    );
    if (!r.ok) return r;
    const changes = diffFields({ name: current.name }, { name: valid.value.name });
    if (Object.keys(changes).length)
      await repos.audit.record({
        entity: ENTITY,
        entityId: input.id,
        action: "UPDATE",
        changes,
        userId: ctx.userId,
        origin: ctx.origin,
      });
    return ok(undefined);
  });
}

export async function setTableActive(
  deps: Deps,
  ctx: RequestContext,
  input: { id: string; active: boolean; version: number },
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "table.manage", ENTITY, input.id);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const current = await repos.tables.get(input.id);
    if (!current) return err("NOT_FOUND");
    const r = await repos.tables.setActive(input.id, input.active, input.version, auditStamp(deps, ctx));
    if (!r.ok) return r;
    if (current.active !== input.active)
      await repos.audit.record({
        entity: ENTITY,
        entityId: input.id,
        action: input.active ? "REACTIVATE" : "DEACTIVATE",
        changes: diffFields({ active: current.active }, { active: input.active }),
        userId: ctx.userId,
        origin: ctx.origin,
      });
    return ok(undefined);
  });
}

/** "Trocar QR code": o link impresso antes para de funcionar. */
export async function rotateTableQr(
  deps: Deps,
  ctx: RequestContext,
  input: { id: string; version: number },
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "table.manage", ENTITY, input.id);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const stamp = auditStamp(deps, ctx);
    const r = await repos.tables.rotateQr(input.id, deps.tokens.create().token, input.version, stamp);
    if (!r.ok) return r;
    await repos.audit.record({
      entity: ENTITY,
      entityId: input.id,
      action: "UPDATE",
      changes: { qrRotatedAt: [null, stamp.at.toISOString()] },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok(undefined);
  });
}

export type TableQr = { id: string; name: string; url: string; svg: string };

/** QR codes para imprimir. Sem `ids`: todas as mesas ativas. */
export async function tableQrCodes(
  deps: Deps,
  ctx: RequestContext,
  input: { ids?: readonly string[] },
): Promise<Result<{ restaurantName: string; tables: TableQr[] }>> {
  const allowed = await authorize(deps, ctx, "table.manage", ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const settings = await repos.orderingSettings.get();
    const wanted = input.ids?.length ? new Set(input.ids) : null;
    const rows = (await repos.tables.list(true))
      .filter((t) => (wanted ? wanted.has(t.id) : t.active))
      .sort((a, b) => compareTableNames(a.name, b.name));
    const base = deps.appUrl.replace(/\/+$/, "");
    const tables = await Promise.all(
      rows.map(async (t) => {
        const url = `${base}/m/${t.qrToken}`;
        return { id: t.id, name: t.name, url, svg: await deps.qr.svg(url) };
      }),
    );
    return ok({ restaurantName: settings.restaurantName, tables });
  });
}

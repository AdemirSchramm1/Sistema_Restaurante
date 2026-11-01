import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import type { StorageClass } from "@/domain/inventory/default-tree";
import { nextTwoDigitCode } from "@/domain/inventory/item-code";
import { err, ok, type Result } from "@/domain/shared/result";

const NAME_MIN = 2;
const NAME_MAX = 80;
const validName = (name: string) => {
  const n = name.trim();
  return n.length >= NAME_MIN && n.length <= NAME_MAX ? n : null;
};

export async function createGroup(
  deps: Deps,
  ctx: RequestContext,
  input: { name: string; storageClass: StorageClass; inCogs: boolean },
): Promise<Result<{ id: string; code: string }>> {
  const allowed = await authorize(deps, ctx, "group.manage", "item_group");
  if (!allowed.ok) return allowed;
  const name = validName(input.name);
  if (!name) return err("VALIDATION", "name");
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const code = nextTwoDigitCode(await repos.groups.takeNextGroupCode());
    if (!code.ok) return code;
    const id = deps.ids.next();
    const r = await repos.groups.insertGroup(
      { id, code: code.value, name, storageClass: input.storageClass, inCogs: input.inCogs },
      auditStamp(deps, ctx),
    );
    if (!r.ok) return r;
    await repos.audit.record({
      entity: "item_group",
      entityId: id,
      action: "CREATE",
      changes: {
        code: [null, code.value],
        name: [null, name],
        storageClass: [null, input.storageClass],
        inCogs: [null, input.inCogs],
      },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok({ id, code: code.value });
  });
}

export async function createSubgroup(
  deps: Deps,
  ctx: RequestContext,
  input: { groupId: string; name: string },
): Promise<Result<{ id: string; code: string }>> {
  const allowed = await authorize(deps, ctx, "group.manage", "item_subgroup");
  if (!allowed.ok) return allowed;
  const name = validName(input.name);
  if (!name) return err("VALIDATION", "name");
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const group = await repos.groups.getGroup(input.groupId);
    if (!group) return err("NOT_FOUND", "groupId");
    if (!group.active) return err("SUBGROUP_INACTIVE", "groupId");
    const code = nextTwoDigitCode(await repos.groups.takeNextSubgroupCode(group.id));
    if (!code.ok) return code;
    const id = deps.ids.next();
    const r = await repos.groups.insertSubgroup(
      { id, groupId: group.id, code: code.value, name },
      auditStamp(deps, ctx),
    );
    if (!r.ok) return r;
    await repos.audit.record({
      entity: "item_subgroup",
      entityId: id,
      action: "CREATE",
      changes: { code: [null, `${group.code}.${code.value}`], name: [null, name] },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok({ id, code: code.value });
  });
}

export async function renameGroup(
  deps: Deps,
  ctx: RequestContext,
  id: string,
  version: number,
  newName: string,
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "group.manage", "item_group", id);
  if (!allowed.ok) return allowed;
  const name = validName(newName);
  if (!name) return err("VALIDATION", "name");
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const g = await repos.groups.getGroup(id);
    if (!g) return err("NOT_FOUND");
    const r = await repos.groups.renameGroup(id, name, version, auditStamp(deps, ctx));
    if (!r.ok) return r;
    await repos.audit.record({
      entity: "item_group",
      entityId: id,
      action: "UPDATE",
      changes: { name: [g.name, name] },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok(undefined);
  });
}

export async function renameSubgroup(
  deps: Deps,
  ctx: RequestContext,
  id: string,
  version: number,
  newName: string,
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "group.manage", "item_subgroup", id);
  if (!allowed.ok) return allowed;
  const name = validName(newName);
  if (!name) return err("VALIDATION", "name");
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const s = await repos.groups.getSubgroup(id);
    if (!s) return err("NOT_FOUND");
    const r = await repos.groups.renameSubgroup(id, name, version, auditStamp(deps, ctx));
    if (!r.ok) return r;
    await repos.audit.record({
      entity: "item_subgroup",
      entityId: id,
      action: "UPDATE",
      changes: { name: [s.name, name] },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok(undefined);
  });
}

/** Grupos padrão não inativam; grupo do restaurante só sem itens ativos (FR-010). */
export async function setGroupActive(
  deps: Deps,
  ctx: RequestContext,
  id: string,
  version: number,
  active: boolean,
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "group.manage", "item_group", id);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const g = await repos.groups.getGroup(id);
    if (!g) return err("NOT_FOUND");
    if (g.isSystem && !active) return err("SYSTEM_RECORD");
    if (!active) {
      const tree = await repos.groups.tree(true);
      const subs = tree.find((x) => x.id === id)?.subgroups ?? [];
      if (subs.some((s) => s.activeItems > 0)) return err("SUBGROUP_HAS_ACTIVE_ITEMS");
    }
    const r = await repos.groups.setGroupActive(id, active, version, auditStamp(deps, ctx));
    if (!r.ok) return r;
    await repos.audit.record({
      entity: "item_group",
      entityId: id,
      action: active ? "REACTIVATE" : "DEACTIVATE",
      changes: { active: [!active, active] },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok(undefined);
  });
}

export async function setSubgroupActive(
  deps: Deps,
  ctx: RequestContext,
  id: string,
  version: number,
  active: boolean,
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "group.manage", "item_subgroup", id);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const s = await repos.groups.getSubgroup(id);
    if (!s) return err("NOT_FOUND");
    if (!active && (await repos.items.activeCountInSubgroup(id)) > 0) return err("SUBGROUP_HAS_ACTIVE_ITEMS");
    const r = await repos.groups.setSubgroupActive(id, active, version, auditStamp(deps, ctx));
    if (!r.ok) return r;
    await repos.audit.record({
      entity: "item_subgroup",
      entityId: id,
      action: active ? "REACTIVATE" : "DEACTIVATE",
      changes: { active: [!active, active] },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok(undefined);
  });
}

import type { Deps, Repos } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import type { AddonRecord } from "./ports";
import { validateAddon, type AddonData } from "@/domain/ordering/addon";
import { refKey, type ComponentRef } from "@/domain/inventory/recipe";
import { recipeCost } from "@/domain/inventory/recipe-graph";
import { costBand, costShare, type CostBand } from "@/domain/inventory/product-cost";
import { formatBrDecimal, type Decimal } from "@/domain/shared/decimal";
import { diffFields } from "@/domain/shared/audit";
import { err, ok, type Result } from "@/domain/shared/result";

/** Adicionais (spec 010, US1). Só o gerente escreve; gerente e chef leem. */

const ENTITY = "addon";

export type AddonView = AddonRecord & {
  /** Custo de uma vez, pelo custo médio dos itens; `null` se falta custo. */
  cost: Decimal | null;
  /** % do preço; `null` quando é grátis ou sem custo. */
  costShare: Decimal | null;
  band: CostBand | null;
};

export type AddonDetail = AddonView & { usedBy: { id: string; name: string }[]; componentInactive: boolean };

/** Forma gravada na auditoria: legível, sem ids. */
const auditView = (
  a: { name: string; quantity: Decimal; unit: string; price: Decimal },
  componentName: string,
) => ({
  name: a.name,
  component: componentName,
  quantity: `${formatBrDecimal(a.quantity)} ${a.unit}`,
  price: a.price.toFixed(2),
});

async function costing(repos: Repos, addons: readonly AddonRecord[]) {
  const graph = await repos.recipes.subRecipeGraph();
  const refs = new Map<string, ComponentRef>();
  addons.forEach((a) => refs.set(refKey(a.component), a.component));
  graph.forEach((n) => n.lines.forEach((l) => refs.set(refKey(l.component), l.component)));
  const found = refs.size ? await repos.recipes.components([...refs.values()]) : [];
  const byKey = new Map(found.map((c) => [refKey(c.ref), c]));
  // Os itens do adicional e dos preparos existem (chave estrangeira) e vieram todos na busca.
  const item = (id: string) => {
    const c = byKey.get(refKey({ kind: "ITEM", id }))!;
    return { stockUnit: c.unit, averageCost: c.averageCost };
  };
  return (a: AddonRecord): AddonView => {
    const cost = recipeCost(
      [{ component: a.component, quantity: a.quantity, unit: a.unit }],
      graph,
      item,
    ).total;
    const share = cost && a.price.gt(0) ? costShare(cost, a.price) : null;
    return { ...a, cost, costShare: share, band: share ? costBand(share) : null };
  };
}

async function validate(repos: Repos, input: AddonData) {
  const [info] = await repos.recipes.components([input.component]);
  const valid = validateAddon(input, (ref) => (info && refKey(info.ref) === refKey(ref) ? info : undefined));
  return valid.ok ? ok({ ...valid.value, componentName: info!.name }) : valid;
}

export async function listAddons(
  deps: Deps,
  ctx: RequestContext,
  input: { includeInactive?: boolean },
): Promise<Result<AddonView[]>> {
  const allowed = await authorize(deps, ctx, "addon.read", ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const rows = await repos.addons.list(input.includeInactive ?? false);
    const evaluate = await costing(repos, rows);
    return ok(rows.map(evaluate));
  });
}

export async function getAddon(deps: Deps, ctx: RequestContext, id: string): Promise<Result<AddonDetail>> {
  const allowed = await authorize(deps, ctx, "addon.read", ENTITY, id);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const a = await repos.addons.get(id);
    if (!a) return err("NOT_FOUND");
    const evaluate = await costing(repos, [a]);
    return ok({
      ...evaluate(a),
      usedBy: await repos.addons.usedBy(id),
      componentInactive: !a.componentActive,
    });
  });
}

export async function createAddon(
  deps: Deps,
  ctx: RequestContext,
  input: AddonData,
): Promise<Result<{ id: string }>> {
  const allowed = await authorize(deps, ctx, "addon.write", ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const valid = await validate(repos, input);
    if (!valid.ok) return valid;
    const id = deps.ids.next();
    const data = { ...input, name: valid.value.name };
    const inserted = await repos.addons.insert(
      { ...data, id, normalized: valid.value.normalized },
      auditStamp(deps, ctx),
    );
    if (!inserted.ok) return inserted;
    await repos.audit.record({
      entity: ENTITY,
      entityId: id,
      action: "CREATE",
      changes: diffFields(null, auditView(data, valid.value.componentName)),
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok({ id });
  });
}

export async function updateAddon(
  deps: Deps,
  ctx: RequestContext,
  input: AddonData & { id: string; version: number },
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "addon.write", ENTITY, input.id);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const current = await repos.addons.get(input.id);
    if (!current) return err("NOT_FOUND");
    const valid = await validate(repos, input);
    if (!valid.ok) return valid;
    const { id: _id, version, ...rest } = input;
    const data = { ...rest, name: valid.value.name };
    const r = await repos.addons.update(
      input.id,
      { ...data, normalized: valid.value.normalized },
      version,
      auditStamp(deps, ctx),
    );
    if (!r.ok) return r;
    const changes = diffFields(
      auditView(current, current.componentName),
      auditView(data, valid.value.componentName),
    );
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

/** Inativo some do cardápio na hora; o pedido já enviado guarda a cópia (FR-007). */
export async function setAddonActive(
  deps: Deps,
  ctx: RequestContext,
  input: { id: string; active: boolean; version: number },
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "addon.write", ENTITY, input.id);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const current = await repos.addons.get(input.id);
    if (!current) return err("NOT_FOUND");
    const r = await repos.addons.setActive(input.id, input.active, input.version, auditStamp(deps, ctx));
    if (!r.ok) return r;
    if (current.active !== input.active)
      await repos.audit.record({
        entity: ENTITY,
        entityId: input.id,
        action: input.active ? "REACTIVATE" : "DEACTIVATE",
        changes: { active: [current.active, input.active] },
        userId: ctx.userId,
        origin: ctx.origin,
      });
    return ok(undefined);
  });
}

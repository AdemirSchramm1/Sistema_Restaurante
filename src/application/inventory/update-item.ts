import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import { itemAuditView } from "./item-audit";
import { canChangeStockUnit, validateItem, type ItemData } from "@/domain/inventory/item";
import { normalizeDescription } from "@/domain/inventory/description";
import { diffFields } from "@/domain/shared/audit";
import { err, ok, type Result } from "@/domain/shared/result";

/** Edita item com trava otimista (FR-031). O código nunca muda, nem trocando de subgrupo. */
export async function updateItem(
  deps: Deps,
  ctx: RequestContext,
  id: string,
  version: number,
  data: ItemData,
): Promise<Result<{ version: number }>> {
  const allowed = await authorize(deps, ctx, "item.write", "item", id);
  if (!allowed.ok) return allowed;
  const valid = validateItem(data);
  if (!valid.ok) return valid;

  return deps.tenant(ctx.restaurantId, async (repos) => {
    const current = await repos.items.get(id);
    if (!current) return err("NOT_FOUND");
    const unit = canChangeStockUnit(current, data.stockUnit);
    if (!unit.ok) return unit;

    if (data.subgroupId !== current.subgroupId) {
      const sub = await repos.groups.getSubgroup(data.subgroupId);
      if (!sub) return err("NOT_FOUND", "subgroupId");
      if (!sub.active || !sub.group.active) return err("SUBGROUP_INACTIVE", "subgroupId");
    }

    const normalized = normalizeDescription(data.description);

    const updated = await repos.items.update(
      id,
      { ...data, descriptionNormalized: normalized },
      version,
      auditStamp(deps, ctx),
    );
    // Versão velha ou descrição repetida entre ativos: a trava otimista e o índice único recusam.
    if (!updated.ok) return updated;
    const changes = diffFields(itemAuditView(current), itemAuditView(data));
    if (Object.keys(changes).length)
      await repos.audit.record({
        entity: "item",
        entityId: id,
        action: "UPDATE",
        changes,
        userId: ctx.userId,
        origin: ctx.origin,
      });
    return ok({ version: version + 1 });
  });
}

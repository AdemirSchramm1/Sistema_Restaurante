import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import { itemAuditView } from "./item-audit";
import { validateItem, type ItemData } from "@/domain/inventory/item";
import { normalizeDescription } from "@/domain/inventory/description";
import { formatItemCode } from "@/domain/inventory/item-code";
import { diffFields } from "@/domain/shared/audit";
import { err, ok, type Result } from "@/domain/shared/result";

/** Cadastra item; o código GG.SS.NNNN é gerado aqui (US1, FR-017 a FR-022). */
export async function createItem(
  deps: Deps,
  ctx: RequestContext,
  data: ItemData,
): Promise<Result<{ id: string; code: string }>> {
  const allowed = await authorize(deps, ctx, "item.write", "item");
  if (!allowed.ok) return allowed;
  const valid = validateItem(data);
  if (!valid.ok) return valid;

  return deps.tenant(ctx.restaurantId, async (repos) => {
    const sub = await repos.groups.getSubgroup(data.subgroupId);
    if (!sub) return err("NOT_FOUND", "subgroupId");
    if (!sub.active || !sub.group.active) return err("SUBGROUP_INACTIVE", "subgroupId");

    const normalized = normalizeDescription(data.description);

    const seq = await repos.items.takeNextItemSeq(sub.id);
    const code = formatItemCode(sub.group.code, sub.code, seq);
    if (!code.ok) return code;

    const id = deps.ids.next();
    const inserted = await repos.items.insert(
      { ...data, id, code: code.value, descriptionNormalized: normalized },
      auditStamp(deps, ctx),
    );
    // Descrição repetida entre ativos do subgrupo: o índice único recusa e tudo volta atrás.
    if (!inserted.ok) return inserted;
    await repos.audit.record({
      entity: "item",
      entityId: id,
      action: "CREATE",
      changes: diffFields(null, { code: code.value, ...itemAuditView(data) }),
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok({ id, code: code.value });
  });
}

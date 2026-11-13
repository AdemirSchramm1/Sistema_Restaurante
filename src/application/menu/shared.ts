import type { AuditAction, Deps, Repos } from "../ports";
import type { RequestContext } from "../context";
import { authorize } from "../shared";
import type { Action } from "@/domain/access/permissions";
import type { Result } from "@/domain/shared/result";

export const SECTION_ENTITY = "menu_section";
/** As mudanças de cardápio do produto ficam no histórico do próprio produto. */
export const PRODUCT_ENTITY = "recipe";

export type MenuEvent =
  | "menu.details"
  | "menu.photo.set"
  | "menu.photo.remove"
  | "menu.product.move"
  | "menu.product.create"
  | "menu.section.create"
  | "menu.section.rename"
  | "menu.section.move"
  | "menu.section.delete";

type Target = { entity: string; id?: string };

/**
 * Todo caso de uso da tela Cardápio passa por aqui: confere `menu.write` (e o que mais for pedido),
 * grava a tentativa negada e roda `fn` na transação do restaurante.
 */
export async function withMenuAccess<T>(
  deps: Deps,
  ctx: RequestContext,
  target: Target,
  fn: (repos: Repos) => Promise<Result<T>>,
  also: readonly Action[] = [],
): Promise<Result<T>> {
  for (const action of ["menu.write", ...also] as const) {
    const allowed = await authorize(deps, ctx, action, target.entity, target.id);
    if (!allowed.ok) return allowed;
  }
  return deps.tenant(ctx.restaurantId, fn);
}

/** Linha da auditoria com o nome do evento do cardápio (data-model.md). */
export const recordMenuEvent = (
  repos: Repos,
  ctx: RequestContext,
  target: Required<Target>,
  action: AuditAction,
  event: MenuEvent,
  changes: Record<string, unknown>,
) =>
  repos.audit.record({
    entity: target.entity,
    entityId: target.id,
    action,
    changes: { event, ...changes },
    userId: ctx.userId,
    origin: ctx.origin,
  });

import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { auditStamp } from "../shared";
import { boardProduct, type BoardProduct } from "./board";
import type { MenuDetailsInput } from "./details-input";
import { loadDish, PRODUCT_ENTITY, recordMenuEvent, withMenuAccess } from "./shared";
import { cleanDescription } from "@/domain/menu/description";
import { OTHER_SECTION } from "@/domain/menu/section";
import { businessDay } from "@/domain/ordering/business-day";
import { diffFields } from "@/domain/shared/audit";
import { err, ok, type Result } from "@/domain/shared/result";

/** Descrição e seção do produto no cardápio (spec 013, US1.6, US1.7 e US3.3). */

export type MenuProductView = Omit<BoardProduct, "canMoveUp" | "canMoveDown"> & {
  description: string | null;
  sectionId: string | null;
  version: number;
  sections: { id: string; name: string }[];
};

export function getMenuProduct(
  deps: Deps,
  ctx: RequestContext,
  id: string,
): Promise<Result<MenuProductView>> {
  return withMenuAccess(deps, ctx, { entity: PRODUCT_ENTITY, id }, async (repos) => {
    const found = await loadDish(repos, id);
    if (!found.ok) return found;
    const p = found.value;
    const today = businessDay(deps.clock.now(), (await repos.orderingSettings.get()).timezone);
    const { canMoveUp: _up, canMoveDown: _down, ...shown } = boardProduct(p, [], today);
    const sections = await repos.menuBoard.sections();
    return ok({
      ...shown,
      description: p.description,
      sectionId: p.sectionId,
      version: p.version,
      sections: sections.map((s) => ({ id: s.id, name: s.name })),
    });
  });
}

/**
 * Grava a descrição (texto simples, até 300) e a seção. Quem muda de seção entra no fim da nova e
 * a antiga fecha o buraco. Sobe a `version` do produto, mas não cria versão da ficha técnica.
 */
export function setMenuDetails(
  deps: Deps,
  ctx: RequestContext,
  input: MenuDetailsInput,
): Promise<Result<void>> {
  const target = { entity: PRODUCT_ENTITY, id: input.id };
  return withMenuAccess(deps, ctx, target, async (repos) => {
    await repos.menuBoard.lock();
    const found = await loadDish(repos, input.id);
    if (!found.ok) return found;
    const product = found.value;
    const description = cleanDescription(input.description);
    if (!description.ok) return description;
    const sections = await repos.menuBoard.sections();
    const nameOf = (id: string | null) => sections.find((s) => s.id === id)?.name;
    if (input.sectionId && !nameOf(input.sectionId)) return err("NOT_FOUND", "sectionId");

    const saved = await repos.menuBoard.setDescription(
      input.id,
      description.value,
      input.version,
      auditStamp(deps, ctx),
    );
    if (!saved) return err("STALE_RECORD");

    if (input.sectionId !== product.sectionId) {
      const products = await repos.menuBoard.products();
      const others = (sectionId: string | null) =>
        products.filter((p) => p.sectionId === sectionId && p.id !== input.id).map((p) => p.id);
      await repos.menuBoard.placeProducts(input.sectionId, [...others(input.sectionId), input.id]);
      await repos.menuBoard.placeProducts(product.sectionId, others(product.sectionId));
    }

    const changes = diffFields(
      { menuDescription: product.description, menuSection: nameOf(product.sectionId) ?? OTHER_SECTION },
      { menuDescription: description.value, menuSection: nameOf(input.sectionId) ?? OTHER_SECTION },
    );
    if (Object.keys(changes).length)
      await recordMenuEvent(repos, ctx, target, "UPDATE", "menu.details", changes);
    return ok(undefined);
  });
}

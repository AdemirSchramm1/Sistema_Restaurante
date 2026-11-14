import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import type { MenuProductRecord } from "./ports";
import { PRODUCT_ENTITY, withMenuAccess } from "./shared";
import type { Photo } from "@/domain/menu/photo";
import { canMove } from "@/domain/menu/order";
import { OTHER_SECTION } from "@/domain/menu/section";
import { isSoldOut } from "@/domain/ordering/menu";
import { businessDay } from "@/domain/ordering/business-day";
import { ok, type Result } from "@/domain/shared/result";

/** Tela Cardápio da equipe (spec 013, contracts/use-cases.md). */
export type BoardProduct = {
  id: string;
  name: string;
  /** "28.00"; `null` = sem preço. */
  price: string | null;
  active: boolean;
  soldOutToday: boolean;
  photo: Photo | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
};
export type BoardSection = {
  /** `null` = "Outros". */
  id: string | null;
  name: string;
  version: number | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  products: BoardProduct[];
};
export type MenuBoard = { sections: BoardSection[] };

/** Produto como a tela mostra; `siblings` são os ids do grupo, na ordem. */
export function boardProduct(p: MenuProductRecord, siblings: readonly string[], today: string): BoardProduct {
  const can = canMove(siblings, p.id);
  return {
    id: p.id,
    name: p.name,
    price: p.salePrice ? p.salePrice.toFixed(2) : null,
    active: p.active,
    soldOutToday: isSoldOut(p.soldOutOn, today),
    photo: p.photo,
    canMoveUp: can.up,
    canMoveDown: can.down,
  };
}

/** Seção vazia aparece (para receber produtos); "Outros" só aparece com produtos. */
export function getMenuBoard(deps: Deps, ctx: RequestContext): Promise<Result<MenuBoard>> {
  return withMenuAccess(deps, ctx, { entity: PRODUCT_ENTITY }, async (repos) => {
    const sections = await repos.menuBoard.sections();
    const products = await repos.menuBoard.products();
    const today = businessDay(deps.clock.now(), (await repos.orderingSettings.get()).timezone);
    const sectionIds = sections.map((s) => s.id);
    const group = (sectionId: string | null) => {
      const rows = products.filter((p) => p.sectionId === sectionId);
      const ids = rows.map((p) => p.id);
      return rows.map((p) => boardProduct(p, ids, today));
    };
    const board: BoardSection[] = sections.map((s) => {
      const can = canMove(sectionIds, s.id);
      return {
        id: s.id,
        name: s.name,
        version: s.version,
        canMoveUp: can.up,
        canMoveDown: can.down,
        products: group(s.id),
      };
    });
    const others = group(null);
    if (others.length)
      board.push({
        id: null,
        name: OTHER_SECTION,
        version: null,
        canMoveUp: false,
        canMoveDown: false,
        products: others,
      });
    return ok({ sections: board });
  });
}

import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { PRODUCT_ENTITY, recordMenuEvent, withMenuAccess } from "./shared";
import { move, type Direction } from "@/domain/menu/order";
import { OTHER_SECTION } from "@/domain/menu/section";
import { err, ok, type Result } from "@/domain/shared/result";

/**
 * Sobe ou desce o produto dentro da sua seção (ou de "Outros"), trocando com o vizinho (spec 013,
 * US3). Não mexe na `version`, no preço nem na versão do produto: é só a ordem do cardápio.
 */
export function moveProduct(
  deps: Deps,
  ctx: RequestContext,
  input: { id: string; direction: Direction },
): Promise<Result<void>> {
  const target = { entity: PRODUCT_ENTITY, id: input.id };
  return withMenuAccess(deps, ctx, target, async (repos) => {
    await repos.menuBoard.lock();
    const product = await repos.menuBoard.product(input.id);
    if (!product) return err("NOT_FOUND");
    if (product.kind !== "DISH") return err("NOT_A_DISH");
    const group = (await repos.menuBoard.products()).filter((p) => p.sectionId === product.sectionId);
    const ids = group.map((p) => p.id);
    const moved = move(ids, input.id, input.direction);
    if (!moved.ok) return moved;
    await repos.menuBoard.placeProducts(product.sectionId, moved.value);
    const section = (await repos.menuBoard.sections()).find((s) => s.id === product.sectionId);
    await recordMenuEvent(repos, ctx, target, "UPDATE", "menu.product.move", {
      name: product.name,
      section: section?.name ?? OTHER_SECTION,
      menuPosition: [ids.indexOf(input.id) + 1, moved.value.indexOf(input.id) + 1],
    });
    return ok(undefined);
  });
}

import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { createRecipeIn } from "../inventory/recipes";
import { setSalePriceIn } from "../inventory/product-costs";
import type { MenuProductInput } from "./create-product-input";
import { applyMenuDetails } from "./details";
import { PRODUCT_ENTITY, withMenuAccess } from "./shared";
import { ok, type Result } from "@/domain/shared/result";

/**
 * Produto novo pela tela Cardápio (spec 013, US4): o produto vendido da 003, o preço da 008 e a
 * descrição e a seção do cardápio, numa transação só. Se qualquer parte for recusada, nada fica
 * gravado. A foto vai depois, pelo envio de foto, porque o arquivo não cabe na transação.
 */
export function createMenuProduct(
  deps: Deps,
  ctx: RequestContext,
  input: MenuProductInput,
): Promise<Result<{ id: string }>> {
  return withMenuAccess(
    deps,
    ctx,
    { entity: PRODUCT_ENTITY },
    async (repos) => {
      const created = await createRecipeIn(deps, ctx, repos, {
        name: input.name,
        kind: "DISH",
        yieldQuantity: null,
        yieldUnit: null,
        lines: input.lines,
      });
      if (!created.ok) return created;
      const { id } = created.value;
      let version = 1;
      if (input.salePrice) {
        const priced = await setSalePriceIn(deps, ctx, repos, id, version, input.salePrice);
        if (!priced.ok) return priced;
        version = priced.value.version;
      }
      // Sem descrição e sem seção, o produto fica como nasceu: no fim de "Outros".
      if (input.description || input.sectionId) {
        const detailed = await applyMenuDetails(deps, ctx, repos, { id, version, ...input });
        if (!detailed.ok) return detailed;
      }
      return ok({ id });
    },
    ["recipe.write"],
  );
}

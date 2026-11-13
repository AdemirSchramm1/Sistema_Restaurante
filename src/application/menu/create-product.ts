import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import type { MenuProductInput } from "./create-product-input";
import { err, type Result } from "@/domain/shared/result";

/** Produto novo pela tela Cardápio (spec 013, US4). */
export async function createMenuProduct(
  _deps: Deps,
  _ctx: RequestContext,
  _input: MenuProductInput,
): Promise<Result<{ id: string }>> {
  return err("VALIDATION");
}

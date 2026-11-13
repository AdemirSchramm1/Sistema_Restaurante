import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import type { Direction } from "@/domain/menu/order";
import { err, type Result } from "@/domain/shared/result";

/** Ordem dos produtos dentro da seção (spec 013, US3). */
export async function moveProduct(
  _deps: Deps,
  _ctx: RequestContext,
  _input: { id: string; direction: Direction },
): Promise<Result<void>> {
  return err("VALIDATION");
}

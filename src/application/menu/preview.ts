import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import type { MenuProduct } from "../ordering/menu";
import type { CustomerMenu } from "@/domain/menu/customer-menu";
import { err, type Result } from "@/domain/shared/result";

/** "Ver como o cliente" (spec 013, US5). */
export async function getMenuPreview(
  _deps: Deps,
  _ctx: RequestContext,
): Promise<Result<CustomerMenu<MenuProduct>>> {
  return err("NOT_FOUND");
}

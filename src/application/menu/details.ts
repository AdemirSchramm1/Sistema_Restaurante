import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import type { BoardProduct } from "./board";
import type { MenuDetailsInput } from "./details-input";
import { err, type Result } from "@/domain/shared/result";

export type MenuProductView = Omit<BoardProduct, "canMoveUp" | "canMoveDown"> & {
  description: string | null;
  sectionId: string | null;
  version: number;
  sections: { id: string; name: string }[];
};

export const setMenuDetails = async (
  _d: Deps,
  _c: RequestContext,
  _i: MenuDetailsInput,
): Promise<Result<void>> => err("NO_CHANGE");
export const getMenuProduct = async (
  _d: Deps,
  _c: RequestContext,
  _id: string,
): Promise<Result<MenuProductView>> => err("NO_CHANGE");

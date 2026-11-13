import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import type { Photo } from "@/domain/menu/photo";
import { err, type Result } from "@/domain/shared/result";

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

export async function getMenuBoard(_deps: Deps, _ctx: RequestContext): Promise<Result<MenuBoard>> {
  return err("VALIDATION");
}

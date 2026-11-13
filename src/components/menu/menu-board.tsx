import type { MenuBoard as Board } from "@/application/menu/board";
import type { FormAction } from "./move-buttons";

export type MenuBoardActions = {
  createSection: FormAction;
  renameSection: FormAction;
  moveSection: FormAction;
  deleteSection: FormAction;
  moveProduct: FormAction;
};

export function MenuBoard(_props: { board: Board; actions: MenuBoardActions; canCreateProduct: boolean }) {
  return null;
}

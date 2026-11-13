import type { MenuBoardRepo } from "@/application/menu/ports";
import { ok } from "@/domain/shared/result";
import type { Tx } from "../db";

/** Seções, ordem, descrição e foto do cardápio (spec 013). */
export function menuBoardRepository(_tx: Tx, _restaurantId: string): MenuBoardRepo {
  return {
    lock: async () => undefined,
    sections: async () => [],
    insertSection: async () => ok(undefined),
    renameSection: async () => ok(undefined),
    orderSections: async () => undefined,
    deleteSection: async () => undefined,
    products: async () => [],
    product: async () => null,
    placeProducts: async () => undefined,
    setDescription: async () => ok(undefined),
    setPhoto: async () => undefined,
  };
}

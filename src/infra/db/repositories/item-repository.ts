import type { ItemRepo } from "@/application/inventory/ports";
import type { Tx } from "../db";

export function itemRepository(_tx: Tx, _restaurantId: string, _ids: () => string): ItemRepo {
  return new Proxy({} as ItemRepo, {
    get: () => () => {
      throw new Error("ItemRepo ainda não implementado");
    },
  });
}

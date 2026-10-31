import type { ItemLocationRepo } from "@/application/inventory/ports";
import type { Tx } from "../db";

export function itemLocationRepository(_tx: Tx, _restaurantId: string): ItemLocationRepo {
  return new Proxy({} as ItemLocationRepo, {
    get: () => () => {
      throw new Error("ItemLocationRepo ainda não implementado");
    },
  });
}

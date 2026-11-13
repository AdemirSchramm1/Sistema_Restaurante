import type { MenuProductRow } from "../ordering/menu";
import type { Photo } from "./photo";

/** Cardápio do cliente por seção (spec 013, US2.4, US2.5 e FR-005). Esqueleto. */
export type MenuSectionRow = { id: string; name: string; position: number };
export type CustomerMenuRow = MenuProductRow & {
  description: string | null;
  photo: Photo | null;
  sectionId: string | null;
  menuPosition: number;
};
export type CustomerMenuSection<T> = { id: string | null; name: string; products: T[] };
export type CustomerMenu<T> = { showSectionTitles: boolean; sections: CustomerMenuSection<T>[] };

export function buildCustomerMenu<T extends CustomerMenuRow>(
  _sections: readonly MenuSectionRow[],
  _products: readonly T[],
  _today: string,
): CustomerMenu<T> {
  return { showSectionTitles: false, sections: [] };
}
export function menuProducts<T>(_menu: CustomerMenu<T>): T[] {
  return [];
}

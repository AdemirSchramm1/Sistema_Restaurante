import { normalizeDescription } from "../inventory/description";
import { isOnMenu, type MenuProductRow } from "../ordering/menu";
import type { Photo } from "./photo";
import { OTHER_SECTION } from "./section";

/** Cardápio do cliente por seção (spec 013, US2.4, US2.5 e FR-005). */
export type MenuSectionRow = { id: string; name: string; position: number };
export type CustomerMenuRow = MenuProductRow & {
  description: string | null;
  photo: Photo | null;
  /** `null` = sem seção ("Outros"). */
  sectionId: string | null;
  menuPosition: number;
};
export type CustomerMenuSection<T> = { id: string | null; name: string; products: T[] };
export type CustomerMenu<T> = {
  /** `false` quando nenhum produto que aparece tem seção: o cardápio fica sem títulos. */
  showSectionTitles: boolean;
  sections: CustomerMenuSection<T>[];
};

const byPosition = (a: CustomerMenuRow, b: CustomerMenuRow) =>
  a.menuPosition - b.menuPosition ||
  normalizeDescription(a.name).localeCompare(normalizeDescription(b.name), "pt-BR");

/**
 * Só o que o cliente pode pedir hoje (regra da 009), agrupado nas seções na ordem escolhida, com
 * "Outros" no fim. Seção sem produto não aparece.
 */
export function buildCustomerMenu<T extends CustomerMenuRow>(
  sections: readonly MenuSectionRow[],
  products: readonly T[],
  today: string,
): CustomerMenu<T> {
  const ordered = [...sections].sort((a, b) => a.position - b.position);
  const known = new Set<string | null>(ordered.map((s) => s.id));
  const shown = products.filter((p) => isOnMenu(p, today)).sort(byPosition);
  // Seção que não veio (apagada no meio do caminho) conta como sem seção.
  const inSection = (id: string | null) =>
    shown.filter((p) => (known.has(p.sectionId) ? p.sectionId : null) === id);
  const groups: CustomerMenuSection<T>[] = [
    ...ordered.map((s) => ({ id: s.id, name: s.name, products: inSection(s.id) })),
    { id: null, name: OTHER_SECTION, products: inSection(null) },
  ].filter((g) => g.products.length > 0);
  return { showSectionTitles: groups.some((g) => g.id !== null), sections: groups };
}

/** Todos os produtos, na ordem do cardápio. */
export const menuProducts = <T>(menu: CustomerMenu<T>): T[] => menu.sections.flatMap((s) => s.products);

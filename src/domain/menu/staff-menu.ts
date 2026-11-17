import { isSoldOut } from "../ordering/menu";
import {
  buildCustomerMenu,
  type CustomerMenu,
  type CustomerMenuRow,
  type MenuSectionRow,
} from "./customer-menu";

/** Produto do cardápio da equipe: o do cliente mais o selo de esgotado (spec 015, R7). */
export type StaffMenuRow<T extends CustomerMenuRow = CustomerMenuRow> = T & { soldOut: boolean };

/**
 * Mesmo cardápio do cliente (seções, ordem, preços), mas o esgotado hoje aparece apagado no fim da
 * sua seção, para o garçom responder "acabou" sem procurar (FR-003).
 */
export function buildStaffMenu<T extends CustomerMenuRow>(
  sections: readonly MenuSectionRow[],
  products: readonly T[],
  today: string,
): CustomerMenu<StaffMenuRow<T>> {
  const soldOut = new Set(products.filter((p) => isSoldOut(p.soldOutOn, today)).map((p) => p.id));
  // Para o agrupamento, o esgotado conta como no cardápio; o selo volta em `soldOut`.
  const byId = new Map(products.map((p) => [p.id, p]));
  const menu = buildCustomerMenu(
    sections,
    products.map((p) => (soldOut.has(p.id) ? { ...p, soldOutOn: null } : p)),
    today,
  );
  return {
    showSectionTitles: menu.showSectionTitles,
    sections: menu.sections.map((s) => {
      const rows = s.products.map((p) => ({ ...byId.get(p.id)!, soldOut: soldOut.has(p.id) }));
      return { ...s, products: [...rows.filter((p) => !p.soldOut), ...rows.filter((p) => p.soldOut)] };
    }),
  };
}

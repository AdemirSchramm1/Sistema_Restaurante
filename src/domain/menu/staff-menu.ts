import { isSoldOut } from "../ordering/menu";
import type { CatalogProduct } from "../ordering/checkout";
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

/**
 * Produto da equipe com o catálogo de agora: preço, e adicionais e retiradas que valem hoje. O
 * esgotado vem sem escolhas (não pode ir ao carrinho). Lista vazia quando o produto saiu do cardápio
 * entre a leitura do cardápio e a do catálogo (pronta para o `flatMap`).
 */
export function staffProduct<P>(
  row: { description: string | null; photo: P; soldOut: boolean },
  p: CatalogProduct | undefined,
) {
  if (!p?.salePrice || !(row.soldOut || p.available)) return [];
  const base = {
    id: p.id,
    name: p.name,
    price: p.salePrice.toFixed(2),
    description: row.description,
    photo: row.photo,
    soldOut: row.soldOut,
  };
  if (row.soldOut) return [{ ...base, addons: [], removables: [] }];
  return [
    {
      ...base,
      addons: p.options.addons
        .filter((a) => a.available)
        .map((a) => ({ id: a.addonId, name: a.name, price: a.price.toFixed(2), maxTimes: a.maxTimes })),
      removables: p.options.removables
        .filter((x) => x.available)
        .map((x) => ({ kind: x.component.kind, id: x.component.id, label: x.label })),
    },
  ];
}

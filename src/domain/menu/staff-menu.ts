import type { CustomerMenu, CustomerMenuRow, MenuSectionRow } from "./customer-menu";

export type StaffMenuRow<T extends CustomerMenuRow = CustomerMenuRow> = T & { soldOut: boolean };

export function buildStaffMenu<T extends CustomerMenuRow>(
  _sections: readonly MenuSectionRow[],
  _products: readonly T[],
  _today: string,
): CustomerMenu<StaffMenuRow<T>> {
  return { showSectionTitles: false, sections: [] };
}

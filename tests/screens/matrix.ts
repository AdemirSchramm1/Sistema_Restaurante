import { menuLayout, type MenuLayout } from "../../src/domain/menu/menu-layout";
/**
 * Matriz de telas (spec 013, contracts/screens.md). É a única fonte dos tamanhos: todo teste de
 * tela percorre esta lista. Tamanho novo com problema entra aqui antes da correção (TDD-010).
 */
export type Screen = {
  name: string;
  width: number;
  height: number;
  /** Vale para o cardápio do cliente. */
  customer: boolean;
  /** Vale para a tela Cardápio da equipe. */
  staff: boolean;
  /** Layout do cardápio do cliente nesta largura (spec 016, R10). */
  layout: MenuLayout;
  /** Colunas de cartões do cardápio do cliente (1 na linha do celular). */
  columns: 1 | 3 | 4;
};

const COLUMNS: Record<MenuLayout, 1 | 3 | 4> = { list: 1, grid3: 3, grid3side: 3, grid4side: 4 };
const sized = (s: Omit<Screen, "layout" | "columns">): Screen => {
  const layout = menuLayout(s.width);
  return { ...s, layout, columns: COLUMNS[layout] };
};

export const MATRIX: readonly Screen[] = [
  sized({ name: "celular-pequeno", width: 320, height: 568, customer: true, staff: true }),
  sized({ name: "celular-android", width: 360, height: 800, customer: true, staff: true }),
  sized({ name: "celular-iphone", width: 390, height: 844, customer: true, staff: true }),
  sized({ name: "celular-grande", width: 430, height: 932, customer: true, staff: false }),
  sized({ name: "celular-deitado", width: 844, height: 390, customer: true, staff: false }),
  sized({ name: "tablet-em-pe", width: 768, height: 1024, customer: true, staff: true }),
  sized({ name: "tablet-grande-em-pe", width: 820, height: 1180, customer: true, staff: false }),
  sized({ name: "tablet-deitado", width: 1024, height: 768, customer: true, staff: true }),
  sized({ name: "computador", width: 1280, height: 800, customer: true, staff: true }),
];

export const CUSTOMER_SCREENS = MATRIX.filter((s) => s.customer);
export const STAFF_SCREENS = MATRIX.filter((s) => s.staff);

export const COLOR_MODES = ["light", "dark"] as const;
export type ColorMode = (typeof COLOR_MODES)[number];

export const screen = (name: string): Screen => {
  const found = MATRIX.find((s) => s.name === name);
  if (!found) throw new Error(`tela ${name} não está na matriz`);
  return found;
};

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
  /** Colunas de cartões do cardápio do cliente nesta largura. */
  columns: 1 | 2 | 3;
};

export const MATRIX: readonly Screen[] = [
  { name: "celular-pequeno", width: 320, height: 568, customer: true, staff: true, columns: 1 },
  { name: "celular-android", width: 360, height: 800, customer: true, staff: true, columns: 1 },
  { name: "celular-iphone", width: 390, height: 844, customer: true, staff: true, columns: 1 },
  { name: "celular-grande", width: 430, height: 932, customer: true, staff: false, columns: 1 },
  { name: "celular-deitado", width: 844, height: 390, customer: true, staff: false, columns: 2 },
  { name: "tablet-em-pe", width: 768, height: 1024, customer: true, staff: true, columns: 2 },
  { name: "tablet-grande-em-pe", width: 820, height: 1180, customer: true, staff: false, columns: 2 },
  { name: "tablet-deitado", width: 1024, height: 768, customer: true, staff: true, columns: 3 },
  { name: "computador", width: 1280, height: 800, customer: true, staff: true, columns: 3 },
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

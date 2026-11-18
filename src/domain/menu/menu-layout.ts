/**
 * Layout do cardápio do cliente pela largura da janela (spec 016, FR-002, R10). Os mesmos números
 * estão no `@theme` de `app/globals.css` (`--breakpoint-tab`, e `lg`/`xl` padrão do Tailwind); um teste de tela compara os dois.
 */
export type MenuLayout = "list" | "grid3" | "grid3side" | "grid4side";

export const LAYOUT_BREAKPOINTS = { tab: 600, lg: 1024, xl: 1280 } as const;
export const CART_COLUMN_PX = 320;

export function menuLayout(width: number): MenuLayout {
  if (width >= LAYOUT_BREAKPOINTS.xl) return "grid4side";
  if (width >= LAYOUT_BREAKPOINTS.lg) return "grid3side";
  if (width >= LAYOUT_BREAKPOINTS.tab) return "grid3";
  return "list";
}

/** Carrinho em coluna ao lado (telas largas) ou barra no pé (US3). */
export const cartBeside = (layout: MenuLayout): boolean => layout === "grid3side" || layout === "grid4side";

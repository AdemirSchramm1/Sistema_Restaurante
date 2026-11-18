import { contrastRatio } from "@/lib/contrast";

/**
 * Camada escura sobre a capa do cardápio (spec 016, R9): degradê preto, mais fraco em cima e mais
 * forte embaixo, onde ficam o nome do restaurante e "Mesa 12" em branco.
 */
export const COVER_OVERLAY = { top: 0.45, bottom: 0.7 } as const;

export const coverGradient = (o: { top: number; bottom: number } = COVER_OVERLAY) =>
  `linear-gradient(to bottom, rgb(0 0 0 / ${o.top}), rgb(0 0 0 / ${o.bottom}))`;

/** Canal sRGB (0 a 1) para luz linear, como na fórmula de luminância relativa da WCAG. */
export const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/**
 * Contraste do texto branco na linha de baixo, sobre a pior capa possível (toda branca): o branco
 * misturado com o preto da camada vira um cinza; luminância relativa dele contra a do branco.
 */
export function coverTextContrast(bottom: number = COVER_OVERLAY.bottom): number {
  const grey = 1 - bottom;
  return contrastRatio(1, srgbToLinear(grey));
}

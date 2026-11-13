/**
 * Contraste WCAG das cores do tema (spec 012, FR-002). OKLCH → sRGB linear pela matriz de
 * referência do OKLab (Björn Ottosson); a luminância relativa usa o sRGB linear limitado a 0–1.
 * Só para conferir o tema em teste: números de cor não são dinheiro nem quantidade.
 */

export type Oklch = { l: number; c: number; h: number };

const OKLCH = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/;

/** Lê `oklch(L C H)`; L pode vir em fração (0.5) ou porcentagem (50%). */
export function parseOklch(text: string): Oklch | null {
  const m = OKLCH.exec(text.trim());
  if (!m) return null;
  const l = Number.parseFloat(m[1]!);
  return { l: m[2] ? l / 100 : l, c: Number.parseFloat(m[3]!), h: Number.parseFloat(m[4]!) };
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/** Luminância relativa (WCAG) de uma cor OKLCH. */
export function luminanceOfOklch({ l, c, h }: Oklch): number {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = clamp(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_);
  const g = clamp(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_);
  const bl = clamp(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_);
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}

/** Contraste WCAG entre duas luminâncias: de 1:1 a 21:1. */
export function contrastRatio(a: number, b: number): number {
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

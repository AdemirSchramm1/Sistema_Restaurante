export type Oklch = { l: number; c: number; h: number };

export function parseOklch(_text: string): Oklch | null {
  return null;
}

export function luminanceOfOklch(_color: Oklch): number {
  return -1;
}

export function contrastRatio(_a: number, _b: number): number {
  return 0;
}

/**
 * Sorteio com semente fixa (mulberry32): o mesmo povoamento sai igual a cada execução. Só para
 * escolher quantos clientes, o quê e quando; valores de dinheiro e de estoque seguem em decimal.
 */
export type Random = {
  /** Entre 0 (inclusive) e 1. */
  next(): number;
  /** Inteiro entre `min` e `max`, os dois inclusive. */
  int(min: number, max: number): number;
  chance(p: number): boolean;
  pick<T>(list: readonly T[]): T;
  /** Escolhe pelo peso de cada um; peso zero nunca sai. */
  weighted<T>(list: readonly T[], weight: (x: T) => number): T;
};

export function seededRandom(seed: number): Random {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  return {
    next,
    int,
    chance: (p) => next() < p,
    pick: (list) => list[int(0, list.length - 1)]!,
    weighted(list, weight) {
      const total = list.reduce((s, x) => s + weight(x), 0);
      let r = next() * total;
      for (const x of list) {
        r -= weight(x);
        if (r < 0) return x;
      }
      return list[list.length - 1]!;
    },
  };
}

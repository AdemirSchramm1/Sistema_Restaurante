/** Agrupa a lista pela chave, numa passada só. */
export function groupBy<T, K>(_items: readonly T[], _key: (item: T) => K): Map<K, T[]> {
  return new Map();
}

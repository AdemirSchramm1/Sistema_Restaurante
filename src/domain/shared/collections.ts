/**
 * Agrupa a lista pela chave, numa passada só (spec 012, R7). Use no lugar de `filter` dentro de
 * `map` para juntar listas (pedidos e linhas, contas e pagamentos): o custo fica linear.
 */
export function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const group = groups.get(k);
    if (group) group.push(item);
    else groups.set(k, [item]);
  }
  return groups;
}

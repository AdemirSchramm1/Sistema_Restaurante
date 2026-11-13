/** Filtro da URL (`searchParams`): o texto, ou nada se vier vazio, repetido ou ausente. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

export type ReorderMenuProduct = {
  id: string;
  name: string;
  price: string;
  soldOut: boolean;
  addons: { id: string; name: string; price: string; maxTimes: number }[];
  removables: { kind: "ITEM" | "RECIPE"; id: string; label: string }[];
};
export const reorderLines = (_l: unknown[], _m: Map<string, ReorderMenuProduct>) => ({
  lines: [] as unknown[],
  leftOut: [] as string[],
});

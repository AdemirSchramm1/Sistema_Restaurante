import type { GroupTree } from "@/application/inventory/ports";
import type { SubgroupOption } from "./item-form";

export function subgroupOptions(tree: GroupTree, keepId?: string): SubgroupOption[] {
  return tree.flatMap((g) =>
    g.subgroups
      .filter((s) => (s.active && g.active) || s.id === keepId)
      .map((s) => ({ id: s.id, label: `${g.code}.${s.code} · ${g.name} › ${s.name}` })),
  );
}

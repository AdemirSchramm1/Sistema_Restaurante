import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireContext } from "@/actions/_session";
import { createItemAction } from "@/actions/items";
import { serverDeps } from "@/infra/server";
import { listGroupTree } from "@/application/inventory/list-group-tree";
import { can } from "@/domain/access/permissions";
import { ItemForm } from "@/components/items/item-form";
import { emptyItemValues } from "@/components/items/item-form-values";
import { subgroupOptions } from "@/components/items/subgroup-options";

export const metadata: Metadata = { title: "Novo item" };

export default async function Page() {
  const ctx = await requireContext();
  if (!can(ctx.roles, "item.write")) redirect("/estoque/itens");
  const tree = await listGroupTree(serverDeps(), ctx);
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Novo item</h1>
      <ItemForm
        action={createItemAction}
        subgroups={tree.ok ? subgroupOptions(tree.value) : []}
        initial={emptyItemValues}
        submitLabel="Cadastrar item"
      />
    </div>
  );
}

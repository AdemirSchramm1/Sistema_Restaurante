import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { createMenuProductAction } from "@/actions/menu-board";
import { serverDeps } from "@/infra/server";
import { recipeFormOptions } from "@/application/inventory/recipes";
import { getMenuBoard } from "@/application/menu/board";
import { can } from "@/domain/access/permissions";
import { NoAccess } from "@/components/layout/no-access";
import { PageHeader } from "@/components/layout/page-header";
import { NewProductForm } from "@/components/menu/new-product-form";

export const metadata: Metadata = { title: "Novo produto" };

/** Produto novo pela tela Cardápio (spec 013, US4). Quem pode: `menu.write` e `recipe.write`. */
export default async function Page() {
  const ctx = await requireContext();
  const deps = serverDeps();
  const board = await getMenuBoard(deps, ctx);
  if (!board.ok || !can(ctx.roles, "recipe.write")) return <NoAccess />;
  const options = await recipeFormOptions(deps, ctx);
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Novo produto"
        description="O produto entra no fim da seção escolhida. O nome e os ingredientes também ficam no cadastro de produtos."
        back={{ href: "/pedidos/cardapio", label: "Voltar para o Cardápio" }}
      />
      <NewProductForm
        options={options.ok ? options.value : { items: [], preps: [] }}
        sections={board.value.sections.flatMap((s) => (s.id ? [{ id: s.id, name: s.name }] : []))}
        action={createMenuProductAction}
      />
    </div>
  );
}

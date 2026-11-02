import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireContext } from "@/actions/_session";
import { createRecipeAction } from "@/actions/recipes";
import { serverDeps } from "@/infra/server";
import { recipeFormOptions } from "@/application/inventory/recipes";
import { can } from "@/domain/access/permissions";
import { RecipeForm } from "@/components/recipes/recipe-form";
import { emptyRecipeValues } from "@/components/recipes/recipe-form-values";

export const metadata: Metadata = { title: "Novo produto" };

export default async function Page() {
  const ctx = await requireContext();
  if (!can(ctx.roles, "recipe.write")) redirect("/estoque/produtos");
  const options = await recipeFormOptions(serverDeps(), ctx);
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Novo produto</h1>
      <RecipeForm
        action={createRecipeAction}
        options={options.ok ? options.value : { items: [], preps: [] }}
        initial={emptyRecipeValues}
        submitLabel="Cadastrar produto"
      />
    </div>
  );
}

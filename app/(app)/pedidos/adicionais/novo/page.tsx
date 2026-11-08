import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { createAddonAction } from "@/actions/addons";
import { serverDeps } from "@/infra/server";
import { recipeFormOptions } from "@/application/inventory/recipes";
import { can } from "@/domain/access/permissions";
import { AddonForm } from "@/components/ordering/addon-form";
import { NoAccess } from "@/components/layout/no-access";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Novo adicional" };

export default async function Page() {
  const ctx = await requireContext();
  if (!can(ctx.roles, "addon.write")) return <NoAccess />;
  const options = await recipeFormOptions(serverDeps(), ctx);
  return (
    <div className="grid max-w-xl gap-4">
      <h1 className="text-2xl font-semibold">Novo adicional</h1>
      <Card>
        <AddonForm
          action={createAddonAction}
          options={options.ok ? options.value : { items: [], preps: [] }}
          initial={{ name: "", component: "", quantity: "", unit: "", price: "" }}
          submitLabel="Criar adicional"
        />
      </Card>
    </div>
  );
}

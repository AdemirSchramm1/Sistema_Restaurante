import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireContext } from "@/actions/_session";
import { createSupplierAction } from "@/actions/suppliers";
import { can } from "@/domain/access/permissions";
import { SupplierForm } from "@/components/suppliers/supplier-form";
import { emptySupplierValues } from "@/components/suppliers/supplier-form-values";

export const metadata: Metadata = { title: "Novo fornecedor" };

export default async function Page() {
  const ctx = await requireContext();
  if (!can(ctx.roles, "supplier.write")) redirect("/estoque/fornecedores");
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Novo fornecedor</h1>
      <p className="text-sm text-muted-foreground">
        Só o nome é obrigatório. O resto dá para completar depois.
      </p>
      <SupplierForm
        action={createSupplierAction}
        initial={emptySupplierValues}
        submitLabel="Cadastrar fornecedor"
      />
    </div>
  );
}

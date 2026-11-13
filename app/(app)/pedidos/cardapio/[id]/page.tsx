import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireContext } from "@/actions/_session";
import { removeProductPhotoAction, setMenuDetailsAction } from "@/actions/menu-board";
import { serverDeps } from "@/infra/server";
import { isId } from "@/application/form-input";
import { getMenuProduct } from "@/application/menu/details";
import { NoAccess } from "@/components/layout/no-access";
import { PageHeader } from "@/components/layout/page-header";
import { ProductMenuForm } from "@/components/menu/product-menu-form";

export const metadata: Metadata = { title: "Produto do cardápio" };

/** Produto no Cardápio (spec 013, US1): foto, descrição e seção. */
export default async function Page({ params }: PageProps<"/pedidos/cardapio/[id]">) {
  const ctx = await requireContext();
  const { id } = await params;
  if (!isId(id)) notFound();
  const product = await getMenuProduct(serverDeps(), ctx, id);
  if (!product.ok) {
    if (product.error.code === "FORBIDDEN") return <NoAccess />;
    notFound();
  }
  return (
    <div className="grid gap-6">
      <PageHeader
        title={product.value.name}
        description="Como o cliente vê este produto no cardápio."
        back={{ href: "/pedidos/cardapio", label: "Voltar para o Cardápio" }}
      />
      <ProductMenuForm
        key={product.value.id}
        product={product.value}
        actions={{ setDetails: setMenuDetailsAction, removePhoto: removeProductPhotoAction }}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { can } from "@/domain/access/permissions";
import { NoAccess } from "@/components/layout/no-access";
import { PageHeader } from "@/components/layout/page-header";
import { PreviewFrame } from "@/components/menu/preview-frame";

export const metadata: Metadata = { title: "Ver como o cliente" };

/** "Ver como o cliente" (spec 013, US5): o cardápio do cliente em tamanho de celular e de tablet. */
export default async function Page() {
  const ctx = await requireContext();
  if (!can(ctx.roles, "menu.write")) return <NoAccess />;
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Ver como o cliente"
        description="O cardápio como aparece agora para quem lê o QR code da mesa. Só entram produtos ativos, com preço e não esgotados hoje."
        back={{ href: "/pedidos/cardapio", label: "Voltar para o Cardápio" }}
      />
      <PreviewFrame src="/pedidos/cardapio/ver/cliente" />
    </div>
  );
}

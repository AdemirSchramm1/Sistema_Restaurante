import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { listReorderAlerts } from "@/application/inventory/reorder";
import { ReorderTable } from "@/components/reorder/reorder-table";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Repor" };

export default async function Page() {
  const ctx = await requireContext();
  const r = await listReorderAlerts(serverDeps(), ctx);

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Repor"
        description={
          <>
            Itens que chegaram no ponto de reposição, os que acabaram primeiro. O aviso de cada item é
            definido na página do item, no quadro &quot;Aviso de reposição&quot;.
          </>
        }
      />
      <ReorderTable rows={r.ok ? r.value : []} />
      <p className="text-xs text-muted-foreground">
        Quanto comprar = &quot;Comprar até&quot; − (o que tem agora − o que se gasta até a entrega),
        arredondado para cima na embalagem do fornecedor preferido (ou na do item).
      </p>
    </div>
  );
}

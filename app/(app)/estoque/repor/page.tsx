import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { listReorderAlerts } from "@/application/inventory/reorder";
import { ReorderTable } from "@/components/reorder/reorder-table";

export const metadata: Metadata = { title: "Repor" };

export default async function Page() {
  const ctx = await requireContext();
  const r = await listReorderAlerts(serverDeps(), ctx);

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Repor</h1>
        <p className="text-sm text-muted-foreground">
          Itens que chegaram no ponto de reposição, os que acabaram primeiro. O aviso de cada item é definido
          na página do item, no quadro &quot;Aviso de reposição&quot;.
        </p>
      </div>
      <ReorderTable rows={r.ok ? r.value : []} />
      <p className="text-xs text-muted-foreground">
        Quanto comprar = &quot;Comprar até&quot; − (o que tem agora − o que se gasta até a entrega),
        arredondado para cima na embalagem do fornecedor preferido (ou na do item).
      </p>
    </div>
  );
}

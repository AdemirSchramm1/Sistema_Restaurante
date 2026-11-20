import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { listTablesForStaff } from "@/application/ordering/staff-orders";
import { AutoRefresh } from "@/components/ordering/auto-refresh";
import { TableGrid } from "@/components/staff-ordering/table-grid";
import { NoAccess } from "@/components/layout/no-access";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Lançar pedido" };
export const dynamic = "force-dynamic";

/** Lançar pedido (spec 015, US1): escolher a mesa. Atualiza a cada 10 segundos. */
export default async function Page() {
  const ctx = await requireContext();
  const deps = serverDeps();
  const r = await listTablesForStaff(deps, ctx);
  if (!r.ok) return <NoAccess />;
  return (
    <div className="grid gap-4">
      <AutoRefresh seconds={10} />
      <PageHeader title="Lançar pedido" description="Escolha a mesa para lançar o pedido." />
      <TableGrid
        tables={r.value.tables}
        qrOrdersOff={r.value.qrOrdersOff}
        restaurantId={ctx.restaurantId}
        userId={ctx.userId}
        serverNow={deps.clock.now().toISOString()}
      />
    </div>
  );
}

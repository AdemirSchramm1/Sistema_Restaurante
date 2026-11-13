import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { markDeliveredAction } from "@/actions/kitchen";
import { serverDeps } from "@/infra/server";
import { listReadyOrders } from "@/application/ordering/kitchen";
import { ReadyList } from "@/components/ordering/ready-list";
import { AutoRefresh } from "@/components/ordering/auto-refresh";
import { NoAccess } from "@/components/layout/no-access";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Garçom" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const ctx = await requireContext();
  const r = await listReadyOrders(serverDeps(), ctx);
  if (!r.ok) return <NoAccess />;
  return (
    <div className="grid gap-4">
      <AutoRefresh seconds={5} />
      <PageHeader
        title="Prontos para levar"
        description="Pedidos que a cozinha terminou. A tela se atualiza sozinha."
      />
      <ReadyList
        orders={r.value.map((o) => ({ ...o, readyAt: o.readyAt.toISOString() }))}
        deliver={markDeliveredAction}
      />
    </div>
  );
}

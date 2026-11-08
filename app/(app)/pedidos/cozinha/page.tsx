import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { advanceOrderStatusAction, cancelOrderAction } from "@/actions/kitchen";
import { serverDeps } from "@/infra/server";
import { listKitchenOrders } from "@/application/ordering/kitchen";
import { KitchenBoard } from "@/components/ordering/kitchen-board";
import { AutoRefresh } from "@/components/ordering/auto-refresh";
import { NoAccess } from "@/components/layout/no-access";

export const metadata: Metadata = { title: "Cozinha" };
export const dynamic = "force-dynamic";

/** Pedidos chegam sozinhos: a tela atualiza a cada 5 segundos (research R4). */
export default async function Page() {
  const ctx = await requireContext();
  const r = await listKitchenOrders(serverDeps(), ctx);
  if (!r.ok) return <NoAccess />;
  return (
    <div className="grid gap-4">
      <AutoRefresh seconds={5} />
      <h1 className="text-2xl font-semibold">Cozinha</h1>
      <KitchenBoard
        serverNow={r.value.serverNow}
        orders={r.value.orders.map((o) => ({ ...o, submittedAt: o.submittedAt.toISOString() }))}
        advance={advanceOrderStatusAction}
        cancel={cancelOrderAction}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { advanceOrderStatusAction, cancelOrderAction } from "@/actions/kitchen";
import { serverDeps } from "@/infra/server";
import { listDishesForKitchen, listKitchenOrders } from "@/application/ordering/kitchen";
import { setProductSoldOutAction } from "@/actions/orders";
import { SoldOutList } from "@/components/ordering/sold-out-list";
import { KitchenBoard } from "@/components/ordering/kitchen-board";
import { AutoRefresh } from "@/components/ordering/auto-refresh";
import { NoAccess } from "@/components/layout/no-access";
import { PageHeader } from "@/components/layout/page-header";
import { placedByText } from "@/components/staff-ordering/format";

export const metadata: Metadata = { title: "Cozinha" };
export const dynamic = "force-dynamic";

/** Pedidos chegam sozinhos: a tela atualiza a cada 5 segundos (research R4). */
export default async function Page() {
  const ctx = await requireContext();
  const deps = serverDeps();
  const [r, dishes] = await Promise.all([listKitchenOrders(deps, ctx), listDishesForKitchen(deps, ctx)]);
  if (!r.ok) return <NoAccess />;
  return (
    <div className="grid gap-4">
      <AutoRefresh seconds={5} />
      <PageHeader title="Cozinha" description="Pedidos das mesas por etapa. A tela se atualiza sozinha." />
      <KitchenBoard
        serverNow={r.value.serverNow}
        orders={r.value.orders.map((o) => ({
          ...o,
          submittedAt: o.submittedAt.toISOString(),
          // O tablet já aparece em "Mesa 12 · tablet" (spec 016).
          placedBy: o.source === "TABLET" ? undefined : placedByText(o),
        }))}
        advance={advanceOrderStatusAction}
        cancel={cancelOrderAction}
      />
      {dishes.ok && <SoldOutList dishes={dishes.value} action={setProductSoldOutAction} />}
    </div>
  );
}

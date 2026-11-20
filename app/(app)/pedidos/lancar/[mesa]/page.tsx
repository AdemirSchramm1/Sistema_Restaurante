import type { Metadata } from "next";
import Link from "next/link";
import { requireContext } from "@/actions/_session";
import { cancelOwnOrderAction, deliverFromTableAction, placeStaffOrderAction } from "@/actions/staff-orders";
import { serverDeps } from "@/infra/server";
import { getStaffMenu, listTableOrders } from "@/application/ordering/staff-orders";
import { messageFor } from "@/components/forms/error-messages";
import { TableScreen } from "@/components/staff-ordering/table-screen";
import { NoAccess } from "@/components/layout/no-access";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { firstParam } from "@/lib/search-params";

export const metadata: Metadata = { title: "Lançar pedido" };
export const dynamic = "force-dynamic";

/** A mesa no Lançar pedido (spec 015): Cardápio e Pedidos da mesa (`?aba=pedidos`). */
export default async function Page({ params, searchParams }: PageProps<"/pedidos/lancar/[mesa]">) {
  const ctx = await requireContext();
  const [{ mesa }, sp] = await Promise.all([params, searchParams]);
  const deps = serverDeps();
  const [menu, orders, settings] = await Promise.all([
    getStaffMenu(deps, ctx, mesa),
    listTableOrders(deps, ctx, mesa),
    deps.tenant(ctx.restaurantId, async (r) => ({
      ok: true as const,
      value: await r.orderingSettings.get(),
    })),
  ]);
  if (!menu.ok && menu.error.code === "FORBIDDEN") return <NoAccess />;
  if (!menu.ok || !orders.ok) {
    const error = menu.ok ? (orders.ok ? null : orders.error) : menu.error;
    return (
      <div className="grid gap-4">
        <PageHeader title="Lançar pedido" />
        <Alert tone="warning" role="alert">
          {error ? messageFor(error) : "Mesa não encontrada."}
        </Alert>
        <Link
          href="/pedidos/lancar"
          className={buttonVariants({ variant: "outline", size: "lg", className: "justify-self-start" })}
        >
          Trocar mesa
        </Link>
      </div>
    );
  }
  return (
    <TableScreen
      key={mesa}
      menu={menu.value}
      orders={orders.value}
      restaurantId={ctx.restaurantId}
      userId={ctx.userId}
      timezone={settings.ok ? settings.value.timezone : "America/Sao_Paulo"}
      serverNow={deps.clock.now().toISOString()}
      initialView={firstParam(sp.aba) === "pedidos" ? "orders" : "menu"}
      place={placeStaffOrderAction}
      deliver={deliverFromTableAction}
      cancel={cancelOwnOrderAction}
    />
  );
}

import { serverDeps } from "@/infra/server";
import { getMenu, listAccessOrders } from "@/application/ordering/menu";
import { submitOrderAction } from "@/actions/menu";
import { menuCookies } from "@/actions/_menu-cookies";
import { messageFor } from "@/components/forms/error-messages";
import { MenuApp } from "@/components/ordering/menu-app";
import { TabletShell } from "@/components/ordering/tablet-shell";

export const dynamic = "force-dynamic";

/** Cardápio aberto pelo QR code da mesa (spec 009) ou pelo tablet fixo nela (spec 016). Sem cookie válido, só a mensagem. */
export default async function Page() {
  const cookie = await menuCookies();
  const deps = serverDeps();
  // Cardápio e pedidos da mesa são leituras independentes: em paralelo no celular do cliente.
  const [menu, orders] = await Promise.all([getMenu(deps, cookie), listAccessOrders(deps, cookie)]);
  if (!menu.ok)
    return (
      <div className="grid min-h-[60vh] place-items-center text-center">
        <p role="alert" className="max-w-sm text-lg">
          {messageFor(menu.error)}
        </p>
      </div>
    );
  const shown = orders.ok ? orders.value : [];
  if (menu.value.mode === "TABLET")
    return <TabletShell menu={menu.value} orders={shown} submit={submitOrderAction} />;
  return <MenuApp menu={menu.value} orders={shown} submit={submitOrderAction} />;
}

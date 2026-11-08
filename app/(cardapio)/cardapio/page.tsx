import { cookies } from "next/headers";
import { serverDeps } from "@/infra/server";
import { getMenu, listAccessOrders } from "@/application/ordering/menu";
import { MENU_ACCESS_COOKIE } from "@/actions/_qr-scan";
import { submitOrderAction } from "@/actions/menu";
import { messageFor } from "@/components/forms/error-messages";
import { MenuApp } from "@/components/ordering/menu-app";

export const dynamic = "force-dynamic";

/** Cardápio aberto pelo QR code da mesa (spec 009 US2/US3). Sem cookie válido, só a mensagem. */
export default async function Page() {
  const cookie = (await cookies()).get(MENU_ACCESS_COOKIE)?.value ?? null;
  const deps = serverDeps();
  const menu = await getMenu(deps, cookie);
  if (!menu.ok)
    return (
      <div className="grid min-h-[60vh] place-items-center text-center">
        <p role="alert" className="max-w-sm text-lg">
          {messageFor(menu.error)}
        </p>
      </div>
    );
  const orders = await listAccessOrders(deps, cookie);
  return <MenuApp menu={menu.value} orders={orders.ok ? orders.value : []} submit={submitOrderAction} />;
}

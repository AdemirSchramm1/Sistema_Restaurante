import type { Deps, Repos } from "../ports";
import { accessFromCookie, loadAccess } from "./menu-access";
import { isAccessOpen } from "@/domain/ordering/menu-access";
import { MAX_ORDERS_PER_ACCESS } from "@/domain/ordering/order-lines";
import { businessDay } from "@/domain/ordering/business-day";
import {
  buildCustomerMenu,
  menuProducts,
  type CustomerMenu,
  type CustomerMenuRow,
} from "@/domain/menu/customer-menu";
import type { Photo } from "@/domain/menu/photo";
import type { OrderStatus } from "@/domain/ordering/order";
import { err, ok, type Result } from "@/domain/shared/result";

/** Cardápio do celular e "Meus pedidos" (spec 009 US2, spec 010 US3). Sem login: só o cookie. */

export type MenuProduct = {
  id: string;
  name: string;
  price: string;
  /** Texto simples com quebras de linha (spec 013, US1.6). */
  description: string | null;
  photo: Photo | null;
  addons: { id: string; name: string; price: string; maxTimes: number }[];
  removables: { kind: "ITEM" | "RECIPE"; id: string; label: string }[];
};

export type MenuView = {
  restaurantName: string;
  tableName: string;
  serverNow: string;
  expiresAt: string;
  ordersLeft: number;
} & CustomerMenu<MenuProduct>;

export type AccessOrderView = {
  number: number;
  submittedAt: string;
  status: OrderStatus;
  total: string;
  lines: { quantity: number; productName: string; changes: string[] }[];
};

/**
 * O cardápio como o cliente vê (spec 013, US6): só o que dá para pedir hoje, por seção, na ordem
 * escolhida, com descrição, foto e os botões da 010. Também serve à pré-visualização da equipe.
 */
export async function customerMenu(repos: Repos, today: string): Promise<CustomerMenu<MenuProduct>> {
  const grouped = buildCustomerMenu(
    await repos.menuBoard.sections(),
    await repos.menuBoard.products(),
    today,
  );
  const catalog = await repos.menu.catalog(
    menuProducts(grouped).map((r) => r.id),
    today,
  );
  const shown = (r: CustomerMenuRow): MenuProduct[] => {
    const p = catalog.get(r.id);
    if (!p?.available || !p.salePrice) return [];
    return [
      {
        id: p.id,
        name: p.name,
        price: p.salePrice.toFixed(2),
        description: r.description,
        photo: r.photo,
        addons: p.options.addons
          .filter((a) => a.available)
          .map((a) => ({ id: a.addonId, name: a.name, price: a.price.toFixed(2), maxTimes: a.maxTimes })),
        removables: p.options.removables
          .filter((x) => x.available)
          .map((x) => ({ kind: x.component.kind, id: x.component.id, label: x.label })),
      },
    ];
  };
  const sections = grouped.sections
    .map((s) => ({ ...s, products: s.products.flatMap(shown) }))
    .filter((s) => s.products.length > 0);
  return { showSectionTitles: sections.some((s) => s.id !== null), sections };
}

export async function getMenu(deps: Deps, cookie: string | null): Promise<Result<MenuView>> {
  const found = await accessFromCookie(deps, cookie);
  if (!found.ok) return found;
  return deps.tenant(found.value.restaurantId, async (repos) => {
    const loaded = await loadAccess(repos, found.value.menuAccessId);
    if (!loaded.ok) return loaded;
    const { access, table, settings } = loaded.value;
    const now = deps.clock.now();
    if (access.endReason === "TAB_CLOSED") return err("TABLE_TAB_CLOSED");
    if (!isAccessOpen(access, now)) return err("ACCESS_EXPIRED");
    if (!table.active) return err("TABLE_INACTIVE");
    if (!settings.acceptingQrOrders) return err("ORDERING_PAUSED");

    const menu = await customerMenu(repos, businessDay(now, settings.timezone));
    const sent = await repos.orders.countForAccess(access.id);
    return ok({
      restaurantName: settings.restaurantName,
      tableName: table.name,
      serverNow: now.toISOString(),
      expiresAt: access.expiresAt.toISOString(),
      ...menu,
      ordersLeft: Math.max(0, MAX_ORDERS_PER_ACCESS - sent),
    });
  });
}

/** Pedidos deste celular (deste acesso), mais novo primeiro. Nunca de outro celular da mesa. */
export async function listAccessOrders(
  deps: Deps,
  cookie: string | null,
): Promise<Result<AccessOrderView[]>> {
  const found = await accessFromCookie(deps, cookie);
  if (!found.ok) return found;
  return deps.tenant(found.value.restaurantId, async (repos) => {
    const access = await repos.menuAccesses.get(found.value.menuAccessId);
    if (!access || !isAccessOpen(access, deps.clock.now())) return err("ACCESS_EXPIRED");
    const orders = await repos.orders.listForAccess(access.id);
    return ok(
      orders.map((o) => ({
        number: o.number,
        submittedAt: o.submittedAt.toISOString(),
        status: o.status,
        total: o.total.toFixed(2),
        lines: o.lines.map(({ quantity, productName, changes }) => ({ quantity, productName, changes })),
      })),
    );
  });
}

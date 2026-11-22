"use client";

import { useState } from "react";
import type { MenuProduct } from "@/application/ordering/menu";
import type { Appearance } from "@/application/menu/ports";
import type { CustomerMenu } from "@/domain/menu/customer-menu";
import { MenuApp } from "./menu-app";
import { TabletWelcome } from "./tablet-welcome";

/**
 * "Ver como o cliente" no modo **Tablet da mesa** (spec 016): as boas-vindas e, ao tocar, o mesmo
 * cardápio da pré-visualização, sem prazo e sem enviar nada. A mesa é um exemplo.
 */
export function TabletPreview({
  menu,
}: {
  menu: CustomerMenu<MenuProduct> & { restaurantName: string; appearance: Appearance };
}) {
  const [welcome, setWelcome] = useState(true);
  if (welcome)
    return (
      <TabletWelcome
        restaurantName={menu.restaurantName}
        tableName="12"
        appearance={menu.appearance}
        onStart={() => setWelcome(false)}
      />
    );
  return <MenuApp preview menu={menu} />;
}

"use client";

import type { MenuProductView } from "@/application/menu/details";
import type { FormAction } from "./move-buttons";

/** Tela do produto no Cardápio (spec 013, US1). */
export function ProductMenuForm(_props: {
  product: MenuProductView;
  actions: { setDetails: FormAction; removePhoto: FormAction };
}) {
  return null;
}

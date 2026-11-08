import type { Decimal } from "../shared/decimal";
import { err, ok, type Result } from "../shared/result";
import { refKey, type ComponentRef } from "../inventory/recipe";
import { checkOrderShape, validateLineQuantity } from "./order-lines";
import { priceLine, validateChoice, type ProductOptions } from "./customization";

/** Produto como está agora, para conferir o envio (spec 009 R9, spec 010 R5). */
export type CatalogProduct = {
  id: string;
  name: string;
  /** Versão mais nova: o pedido guarda por ela (a 005 baixa por ela). */
  versionId: string;
  salePrice: Decimal | null;
  /** Vendido, ativo e não esgotado hoje. */
  available: boolean;
  options: ProductOptions;
};

/** Linha como o cliente viu. */
export type RequestedLine = {
  recipeId: string;
  quantity: number;
  unitPrice: Decimal;
  addons: { addonId: string; times: number; unitPrice: Decimal }[];
  removals: ComponentRef[];
};

export type PricedLine = {
  recipeId: string;
  versionId: string;
  quantity: number;
  basePrice: Decimal;
  unitPrice: Decimal;
  addons: { addonId: string; name: string; times: number; unitPrice: Decimal }[];
  removals: { component: ComponentRef; label: string }[];
};

/**
 * Confere o pedido inteiro. Nada é aceito se algo mudou: indisponível primeiro, depois escolhas,
 * depois preço.
 */
export function checkOrder(
  lines: readonly RequestedLine[],
  catalog: ReadonlyMap<string, CatalogProduct>,
  ordersSoFar = 0,
): Result<PricedLine[]> {
  const shape = checkOrderShape(lines.length, ordersSoFar);
  if (!shape.ok) return shape;
  for (const [i, l] of lines.entries()) {
    const q = validateLineQuantity(l.quantity);
    if (!q.ok) return err("INVALID_QUANTITY", `lines.${i}.quantity`);
  }

  const recipeIds = new Set<string>();
  const addonIds = new Set<string>();
  for (const l of lines) {
    const p = catalog.get(l.recipeId);
    if (!p || !p.available || !p.salePrice) {
      recipeIds.add(l.recipeId);
      continue;
    }
    const offered = new Map(p.options.addons.map((a) => [a.addonId, a]));
    for (const a of l.addons) if (!offered.get(a.addonId)?.available) addonIds.add(a.addonId);
  }
  if (recipeIds.size || addonIds.size)
    return err("PRODUCT_UNAVAILABLE", undefined, { recipeIds: [...recipeIds], addonIds: [...addonIds] });

  for (const [i, l] of lines.entries()) {
    const p = catalog.get(l.recipeId)!;
    const c = validateChoice(p.options, { addons: l.addons, removals: l.removals });
    if (!c.ok) return err(c.error.code, `lines.${i}`, { ...c.error.details, recipeId: l.recipeId });
  }

  const prices = new Map<string, string>();
  const addonPrices = new Map<string, string>();
  const priced: PricedLine[] = [];
  for (const l of lines) {
    const p = catalog.get(l.recipeId)!;
    const base = p.salePrice!;
    let changed = false;
    const offered = new Map(p.options.addons.map((a) => [a.addonId, a]));
    for (const a of l.addons) {
      const now = offered.get(a.addonId)!.price;
      if (!now.equals(a.unitPrice)) {
        addonPrices.set(a.addonId, now.toFixed(2));
        changed = true;
      }
    }
    const expected = priceLine(base, p.options, l);
    if (!changed && !expected.equals(l.unitPrice)) prices.set(l.recipeId, base.toFixed(2));
    const removable = new Map(p.options.removables.map((r) => [refKey(r.component), r]));
    priced.push({
      recipeId: l.recipeId,
      versionId: p.versionId,
      quantity: l.quantity,
      basePrice: base,
      unitPrice: expected,
      addons: l.addons.map((a) => {
        const o = offered.get(a.addonId)!;
        return { addonId: a.addonId, name: o.name, times: a.times, unitPrice: o.price };
      }),
      removals: l.removals.map((r) => ({ component: r, label: removable.get(refKey(r))!.label })),
    });
  }
  if (prices.size || addonPrices.size)
    return err("PRICE_CHANGED", undefined, {
      prices: [...prices].map(([recipeId, price]) => ({ recipeId, price })),
      addonPrices: [...addonPrices].map(([addonId, price]) => ({ addonId, price })),
    });
  return ok(priced);
}

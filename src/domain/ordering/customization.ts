import type { Decimal } from "../shared/decimal";
import { err, ok, type Result } from "../shared/result";
import { refKey, type ComponentRef } from "../inventory/recipe";

/** Adicionar e tirar por botão (spec 010). */
export const MAX_ADDON_TIMES = 5;
export const MAX_OPTIONS = 10;
export const REMOVAL_LABEL_MAX = 40;

/** Opções de um produto como o cardápio e o envio veem. */
export type ProductOptions = {
  addons: { addonId: string; name: string; price: Decimal; maxTimes: number; available: boolean }[];
  /** `available`: o componente ainda está na versão mais nova do produto. */
  removables: { component: ComponentRef; label: string; available: boolean }[];
};

/** O que o cliente escolheu numa linha. */
export type Choice = { addons: { addonId: string; times: number }[]; removals: ComponentRef[] };

export function validateChoice(options: ProductOptions, choice: Choice): Result<void> {
  const byId = new Map(options.addons.map((a) => [a.addonId, a]));
  const seen = new Set<string>();
  const unavailable: string[] = [];
  for (const c of choice.addons) {
    if (seen.has(c.addonId)) return err("DUPLICATE_OPTION");
    seen.add(c.addonId);
    const a = byId.get(c.addonId);
    if (!a || !a.available) unavailable.push(c.addonId);
  }
  if (unavailable.length) return err("PRODUCT_UNAVAILABLE", undefined, { addonIds: unavailable });
  for (const c of choice.addons) {
    const a = byId.get(c.addonId)!;
    if (!Number.isInteger(c.times) || c.times < 1 || c.times > Math.min(a.maxTimes, MAX_ADDON_TIMES))
      return err("INVALID_ADDON_TIMES", undefined, { addonId: c.addonId });
  }
  const removable = new Map(options.removables.map((r) => [refKey(r.component), r]));
  const seenRemovals = new Set<string>();
  const missing: ComponentRef[] = [];
  for (const r of choice.removals) {
    const key = refKey(r);
    if (seenRemovals.has(key)) return err("DUPLICATE_OPTION");
    seenRemovals.add(key);
    if (!removable.get(key)?.available) missing.push(r);
  }
  if (missing.length) return err("OPTION_UNAVAILABLE", undefined, { removals: missing });
  return ok(undefined);
}

/** Preço de uma unidade: produto + Σ(adicional × vezes). Tirar não dá desconto (FR-004). */
export function priceLine(basePrice: Decimal, options: ProductOptions, choice: Choice): Decimal {
  const byId = new Map(options.addons.map((a) => [a.addonId, a]));
  return choice.addons.reduce((s, c) => s.plus(byId.get(c.addonId)!.price.times(c.times)), basePrice);
}

/** Texto para a cozinha: "+ 2 Fatia de queijo", "SEM cebola" (US4-1). */
export function describeChanges(addons: readonly { name: string; times: number }[], removalLabels: readonly string[]) {
  return [
    ...addons.map((a) => `+ ${a.times} ${a.name}`),
    ...removalLabels.map((l) => `SEM ${l.trim().replace(/^sem\s+/i, "")}`),
  ];
}

/** "Cebola roxa" → "Sem cebola roxa". */
export const defaultRemovalLabel = (name: string): string => {
  const n = name.trim();
  return `Sem ${n.charAt(0).toLowerCase()}${n.slice(1)}`;
};

export type CustomizationInput = {
  addons: { addonId: string; maxTimes: number; active: boolean }[];
  removables: { component: ComponentRef; label: string | null; name: string }[];
};
export type CustomizationConfig = {
  addons: { addonId: string; maxTimes: number }[];
  removables: { component: ComponentRef; label: string }[];
};

/**
 * Quadro "Adicionar e tirar" (US2, FR-002). `inProduct`: componentes da versão mais nova
 * (`refKey`).
 */
export function validateCustomizationConfig(
  input: CustomizationInput,
  inProduct: ReadonlySet<string>,
): Result<CustomizationConfig> {
  if (input.addons.length > MAX_OPTIONS || input.removables.length > MAX_OPTIONS) return err("TOO_MANY_OPTIONS");
  const seen = new Set<string>();
  for (const [i, a] of input.addons.entries()) {
    if (seen.has(a.addonId)) return err("DUPLICATE_OPTION", `addons.${i}`);
    seen.add(a.addonId);
    if (!a.active) return err("ADDON_INACTIVE", `addons.${i}`);
    if (!Number.isInteger(a.maxTimes) || a.maxTimes < 1 || a.maxTimes > MAX_ADDON_TIMES)
      return err("INVALID_MAX_TIMES", `addons.${i}.maxTimes`);
  }
  const removables: CustomizationConfig["removables"] = [];
  const seenR = new Set<string>();
  for (const [i, r] of input.removables.entries()) {
    const key = refKey(r.component);
    if (seenR.has(key)) return err("DUPLICATE_OPTION", `removables.${i}`);
    seenR.add(key);
    if (!inProduct.has(key)) return err("NOT_IN_PRODUCT", `removables.${i}`);
    const label = r.label?.trim() || defaultRemovalLabel(r.name);
    if (label.length > REMOVAL_LABEL_MAX) return err("INVALID_LABEL", `removables.${i}.label`);
    removables.push({ component: r.component, label });
  }
  return ok({ addons: input.addons.map(({ addonId, maxTimes }) => ({ addonId, maxTimes })), removables });
}

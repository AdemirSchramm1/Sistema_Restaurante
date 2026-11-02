import type { Decimal } from "../shared/decimal";
import { err, ok, type Result } from "../shared/result";
import { UNITS, unitByCode, type UnitCode } from "./units";
import { findCycle, type RecipeNode } from "./recipe-graph";

/** Produto vendido ao cliente ou preparo usado dentro de outros produtos (spec 003). */
export const RECIPE_KINDS = ["DISH", "SUB_RECIPE"] as const;
export type RecipeKind = (typeof RECIPE_KINDS)[number];

export const RECIPE_KIND_LABELS: Record<RecipeKind, string> = {
  DISH: "Vendido ao cliente",
  SUB_RECIPE: "Preparo (usado dentro de outros produtos)",
};

/** O que vai na linha: um item do estoque ou um preparo. */
export type ComponentRef = { kind: "ITEM" | "RECIPE"; id: string };
export type RecipeLineData = { component: ComponentRef; quantity: Decimal; unit: UnitCode };

/** Campos que o usuário informa (docs/produto/estoque/04-fichas-tecnicas.md). */
export type RecipeData = {
  name: string;
  kind: RecipeKind;
  /** Quanto o preparo rende (só preparo). */
  yieldQuantity: Decimal | null;
  yieldUnit: UnitCode | null;
  lines: RecipeLineData[];
};

/** O que se sabe de cada item ou preparo para validar a linha. `unit` é a medida do item ou do rendimento. */
export type ComponentInfo = {
  ref: ComponentRef;
  name: string;
  active: boolean;
  unit: UnitCode;
  isSubRecipe: boolean;
};

export const NAME_MIN = 3;
export const NAME_MAX = 120;
const MAX_SCALE = 4;

export const refKey = (r: ComponentRef) => `${r.kind}:${r.id}`;

const validQuantity = (q: Decimal | null) => !!q && q.gt(0) && q.decimalPlaces() <= MAX_SCALE;

/** Medidas que podem ser usadas numa linha: a do componente e as da mesma família. */
export function compatibleUnits(unit: UnitCode): UnitCode[] {
  const u = unitByCode(unit);
  return u ? UNITS.filter((x) => x.dimension === u.dimension).map((x) => x.code) : [];
}

/**
 * Todas as regras do produto que não precisam do banco.
 * `previous`: linhas da versão atual (item inativado depois pode continuar nelas).
 * `selfId` e `graph`: para recusar preparo que usaria a si mesmo.
 */
export function validateRecipe(
  data: RecipeData,
  lookup: (ref: ComponentRef) => ComponentInfo | undefined,
  opts: { previous?: RecipeLineData[]; selfId?: string | null; graph?: Map<string, RecipeNode> } = {},
): Result<void> {
  const name = data.name.trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) return err("INVALID_NAME", "name");
  if (!RECIPE_KINDS.includes(data.kind)) return err("VALIDATION", "kind");

  if (data.kind === "SUB_RECIPE") {
    if (!validQuantity(data.yieldQuantity)) return err("INVALID_YIELD", "yieldQuantity");
    if (!data.yieldUnit || !unitByCode(data.yieldUnit)) return err("INVALID_YIELD", "yieldUnit");
  } else if (data.yieldQuantity !== null || data.yieldUnit !== null) {
    return err("VALIDATION", "yieldQuantity");
  }

  if (!data.lines.length) return err("RECIPE_EMPTY", "lines");
  const previous = new Set((opts.previous ?? []).map((l) => refKey(l.component)));
  const seen = new Set<string>();
  for (const [i, line] of data.lines.entries()) {
    const at = (f: string) => `lines.${i}.${f}`;
    const key = refKey(line.component);
    if (seen.has(key)) return err("DUPLICATE_RECIPE_COMPONENT", at("component"));
    seen.add(key);
    if (line.component.kind === "RECIPE" && line.component.id === opts.selfId)
      return err("RECIPE_CYCLE", at("component"));
    const info = lookup(line.component);
    if (!info) return err("NOT_FOUND", at("component"));
    if (line.component.kind === "RECIPE" && !info.isSubRecipe)
      return err("NOT_A_SUB_RECIPE", at("component"));
    if (!info.active && !previous.has(key)) return err("COMPONENT_INACTIVE", at("component"));
    if (!validQuantity(line.quantity)) return err("INVALID_QUANTITY", at("quantity"));
    const unit = unitByCode(line.unit);
    if (!unit) return err("UNKNOWN_UNIT", at("unit"));
    if (unit.dimension !== unitByCode(info.unit)!.dimension)
      return err("UNIT_DIMENSION_MISMATCH", at("unit"), { from: line.unit, to: info.unit });
  }

  if (opts.graph) {
    const cycle = findCycle(opts.selfId ?? null, data.lines, opts.graph);
    if (cycle) return err("RECIPE_CYCLE", "lines", { path: cycle });
  }
  return ok(undefined);
}

/**
 * Preparo usado em produtos ativos (`usedBy`) não pode ser inativado (`next = null`), nem virar
 * vendido, nem trocar o rendimento para outra família de medida.
 */
export function checkSubRecipeChange(
  current: { kind: RecipeKind; yieldUnit: UnitCode | null },
  next: { kind: RecipeKind; yieldUnit: UnitCode | null } | null,
  usedBy: string[],
): Result<void> {
  if (current.kind !== "SUB_RECIPE" || !usedBy.length) return ok(undefined);
  if (!next) return err("RECIPE_IN_USE", undefined, { usedBy });
  if (next.kind !== "SUB_RECIPE") return err("RECIPE_IN_USE", "kind", { usedBy });
  const a = current.yieldUnit && unitByCode(current.yieldUnit);
  const b = next.yieldUnit && unitByCode(next.yieldUnit);
  if (a && b && a.dimension !== b.dimension) return err("RECIPE_IN_USE", "yieldUnit", { usedBy });
  return ok(undefined);
}

type VersionContent = Pick<RecipeData, "yieldQuantity" | "yieldUnit" | "lines">;

const sameDecimal = (a: Decimal | null, b: Decimal | null) =>
  a === null || b === null ? a === b : a.equals(b);

/** Mudou o rendimento ou alguma linha (ordem, quantidade, medida)? Só então nasce versão nova. */
export function hasVersionChanges(current: VersionContent | null, next: VersionContent): boolean {
  if (!current) return true;
  if (!sameDecimal(current.yieldQuantity, next.yieldQuantity) || current.yieldUnit !== next.yieldUnit)
    return true;
  if (current.lines.length !== next.lines.length) return true;
  return current.lines.some((a, i) => {
    const b = next.lines[i]!;
    return refKey(a.component) !== refKey(b.component) || a.unit !== b.unit || !a.quantity.equals(b.quantity);
  });
}

/** Versão vigente numa data: a de maior início até a data. */
export function versionAt<V extends { validFrom: Date }>(versions: readonly V[], at: Date): V | null {
  let best: V | null = null;
  for (const v of versions)
    if (v.validFrom.getTime() <= at.getTime() && (!best || v.validFrom > best.validFrom)) best = v;
  return best;
}

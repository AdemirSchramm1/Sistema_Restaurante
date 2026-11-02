import { d, Decimal } from "../shared/decimal";
import { err, ok, type Result } from "../shared/result";

/**
 * Painel de custo dos produtos (spec 008). Funções puras: recebem o custo já calculado pela 003
 * (`recipeCost`) e o preço de venda; nada de banco nem data.
 * Regras: docs/produto/estoque/04-fichas-tecnicas.md e 10-indicadores.md.
 */

/** Dentro da faixa (até 35%), atenção (até 40%) e alto (acima de 40%). */
export type CostBand = "OK" | "WARN" | "HIGH";

export const COST_BAND_LABELS: Record<CostBand, string> = {
  OK: "dentro da faixa",
  WARN: "atenção",
  HIGH: "alto",
};

/** Fim da faixa comum e começo do "alto" (manual, 10-indicadores). */
export const COST_BAND_LIMITS = { ok: d(35), warn: d(40) } as const;

const PRICE_MAX = d("9999999999.99");

export type ProductCostInput = {
  id: string;
  name: string;
  salePrice: Decimal | null;
  /** Custo de uma unidade; null quando falta custo médio em algum item. */
  cost: Decimal | null;
  /** Custo de cada linha, na ordem do produto. */
  lines: { name: string; cost: Decimal | null }[];
  missingCostNames: string[];
};

export type ProductCost = ProductCostInput & {
  /** Custo no preço, em % (exato). */
  share: Decimal | null;
  band: CostBand | null;
  /** Preço − custo; negativo é prejuízo. */
  margin: Decimal | null;
  /** A linha mais cara e quanto ela é do custo (%). */
  heaviest: { name: string; cost: Decimal; share: Decimal } | null;
};

/** Custo ÷ preço × 100 (04-fichas-tecnicas, critério de aceite). */
export const costShare = (cost: Decimal, price: Decimal): Decimal => cost.div(price).mul(100);

export function costBand(share: Decimal): CostBand {
  if (share.lte(COST_BAND_LIMITS.ok)) return "OK";
  if (share.lte(COST_BAND_LIMITS.warn)) return "WARN";
  return "HIGH";
}

/** Largura da barra: % do preço, inteira (meio para cima), entre 0 e 100. Valor > 0 tem pelo menos 1. */
export function costBarPercent(share: Decimal): number {
  if (share.lte(0)) return 0;
  const pct = share.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  return Math.min(100, Math.max(1, pct));
}

function heaviestLine(p: ProductCostInput): ProductCost["heaviest"] {
  if (!p.cost || p.cost.lte(0)) return null;
  let top: { name: string; cost: Decimal } | null = null;
  for (const l of p.lines) if (l.cost && (!top || l.cost.gt(top.cost))) top = { name: l.name, cost: l.cost };
  return top ? { ...top, share: top.cost.div(p.cost).mul(100) } : null;
}

export function evaluateProductCost(p: ProductCostInput): ProductCost {
  const priced = p.cost !== null && p.salePrice !== null;
  const share = priced ? costShare(p.cost!, p.salePrice!) : null;
  return {
    ...p,
    share,
    band: share ? costBand(share) : null,
    margin: priced ? p.salePrice!.minus(p.cost!) : null,
    heaviest: heaviestLine(p),
  };
}

/** 0 = com %, 1 = sem preço, 2 = sem custo. */
const group = (r: ProductCost) => (r.cost === null ? 2 : r.share === null ? 1 : 0);

/** Maior % primeiro; depois sem preço; depois sem custo; empate pelo nome. */
export function rankProductCosts(rows: readonly ProductCost[]): ProductCost[] {
  return [...rows].sort(
    (a, b) =>
      group(a) - group(b) ||
      (a.share && b.share ? b.share.cmp(a.share) : 0) ||
      a.name.localeCompare(b.name, "pt-BR"),
  );
}

export function summarizeProductCosts(rows: readonly ProductCost[]) {
  const s = { total: rows.length, high: 0, warn: 0, ok: 0, noPrice: 0, noCost: 0 };
  for (const r of rows) {
    if (r.cost === null) s.noCost++;
    else if (r.band === null) s.noPrice++;
    else if (r.band === "HIGH") s.high++;
    else if (r.band === "WARN") s.warn++;
    else s.ok++;
  }
  return s;
}

/** Em branco pode; senão maior que zero e com até 2 casas (spec 008, FR-001). */
export function validateSalePrice(price: Decimal | null): Result<void> {
  if (price === null) return ok(undefined);
  if (price.lte(0) || price.decimalPlaces() > 2 || price.gt(PRICE_MAX)) return err("INVALID_PRICE", "salePrice");
  return ok(undefined);
}

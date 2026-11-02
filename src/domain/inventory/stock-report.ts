import type { UnitCode } from "./units";
import { d, Decimal } from "../shared/decimal";

/** Gráficos do estoque (spec 006, US3). Funções puras: o banco soma, aqui só ordena e mede. */

export const PERIOD_OPTIONS = [7, 30, 90] as const;
export type PeriodDays = (typeof PERIOD_OPTIONS)[number];
const DEFAULT_PERIOD: PeriodDays = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const CHART_LIMIT = 10;

/** Período escolhido na tela (`?dias=`); qualquer outro valor vira 30 dias. */
export function parsePeriod(raw: string | undefined, now: Date) {
  const n = raw && /^\d+$/.test(raw) ? Number.parseInt(raw, 10) : 0;
  const days = (PERIOD_OPTIONS as readonly number[]).includes(n) ? (n as PeriodDays) : DEFAULT_PERIOD;
  return { days, from: new Date(now.getTime() - days * DAY_MS), to: new Date(now) };
}

export type OutflowRow = {
  itemId: string;
  name: string;
  unit: UnitCode;
  /** Quanto saiu no período, na medida do item (positivo). */
  quantity: Decimal;
  /** Valor do que saiu (custo gravado nas movimentações). */
  value: Decimal;
  balance: Decimal;
};

const byName = (a: OutflowRow, b: OutflowRow) => a.name.localeCompare(b.name, "pt-BR");

/**
 * Mais saíram: só quem saiu, do maior valor para o menor.
 * Menos saíram: quem saiu ou tem estoque parado (sem saída), do menor valor para o maior.
 * Ordena por R$ porque kg, l e un não se comparam.
 */
export function rankOutflow(rows: readonly OutflowRow[], limit = CHART_LIMIT) {
  const most = rows
    .filter((r) => r.value.gt(0) || r.quantity.gt(0))
    .sort((a, b) => b.value.cmp(a.value) || byName(a, b))
    .slice(0, limit);
  const least = rows
    .filter((r) => r.value.gt(0) || r.quantity.gt(0) || r.balance.gt(0))
    .sort((a, b) => a.value.cmp(b.value) || a.quantity.cmp(b.quantity) || byName(a, b))
    .slice(0, limit)
    .map((r) => ({ ...r, stopped: r.quantity.isZero() }));
  return { most, least };
}

/** Largura de cada barra em % do maior valor (inteiro, meio para cima); valor > 0 tem no mínimo 2%. */
export function barPercents(values: readonly Decimal[]): number[] {
  const top = values.reduce((m, v) => (v.gt(m) ? v : m), d(0));
  if (top.lte(0)) return values.map(() => 0);
  return values.map((v) => {
    if (v.lte(0)) return 0;
    const pct = v.div(top).mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
    return Math.max(pct, 2);
  });
}

import type { ClosingOutcome } from "@/domain/cash/session";
import type { StepKey } from "@/domain/cash/summary";
import { d, formatBrDecimal, parseBrDecimal, type Decimal } from "@/domain/shared/decimal";
import type { BadgeTone } from "@/components/ui/badge";
import { brl } from "@/components/ordering/format";
import { timeIn } from "@/components/billing/format";

/** Textos do caixa do dia (spec 014). Dinheiro chega do servidor como "125.00". */

/** "17/11/2026" no fuso do restaurante. */
export const dateIn = (at: string, timeZone: string) =>
  new Date(at).toLocaleDateString("pt-BR", { timeZone });

/** Dia do restaurante "2026-11-17" como "17/11/2026". */
export const dayText = (businessDay: string) => businessDay.split("-").reverse().join("/");

const DAY = 86_400_000;

/** "11:02" se abriu hoje, "ontem 11:02" ou "14/11 11:02", pelos dias do fuso do restaurante. */
export function sinceWhen(openedAt: string, now: string, timeZone: string): string {
  const time = timeIn(openedAt, timeZone);
  const day = dateIn(openedAt, timeZone);
  if (day === dateIn(now, timeZone)) return time;
  const yesterday = dateIn(new Date(Date.parse(now) - DAY).toISOString(), timeZone);
  return day === yesterday ? `ontem ${time}` : `${day.slice(0, 5)} ${time}`;
}

/** "às 11:40 por Bruno" ou só "às 11:40". */
export const atBy = (at: string, name: string | null, timeZone: string) =>
  name ? `às ${timeIn(at, timeZone)} por ${name}` : `às ${timeIn(at, timeZone)}`;

/** "Bateu", "Sobra R$ 3,00" ou "Falta R$ 2,00" (US4-3). */
export function outcomeText(result: ClosingOutcome, difference: string): string {
  if (result === "BALANCED") return "Bateu";
  return `${result === "OVER" ? "Sobra" : "Falta"} ${brl(d(difference).abs())}`;
}

export const OUTCOME_TONES: Record<ClosingOutcome, BadgeTone> = {
  BALANCED: "success",
  OVER: "info",
  SHORT: "danger",
};

/** "1ª contagem R$ 120,00 · 2ª contagem R$ 125,00" (US4-2). */
export const countsText = (counts: readonly string[]) =>
  counts.map((c, i) => `${i + 1}ª contagem ${brl(c)}`).join(" · ");

/** Aviso do fechamento com mesas ainda abertas (US4-5). */
export const openTabsText = (n: number) =>
  n === 1
    ? "1 mesa ainda tem conta aberta. Os pagamentos dela vão entrar no próximo turno."
    : `${n} mesas ainda têm conta aberta. Os pagamentos delas vão entrar no próximo turno.`;

/** A conta do esperado, com o nome que o caixa usa (US5-2). */
export const STEP_LABELS: Record<StepKey, string> = {
  OPENING_FLOAT: "Troco inicial",
  CASH_RECEIVED: "Recebido em dinheiro",
  CASH_REMOVED: "Pagamentos em dinheiro tirados de outro turno",
  SUPPLIES: "Reforços",
  WITHDRAWALS: "Sangrias",
  EXPECTED: "Esperado na gaveta",
};

/** "150.00" do servidor → "150,00" no campo. */
export const moneyField = (v: Decimal | string) =>
  formatBrDecimal(typeof v === "string" ? d(v) : v, { minPlaces: 2, maxPlaces: 2 });

/** O que a pessoa digitou como dinheiro, ou nada se não é número. */
export function parsedMoney(text: string): Decimal | null {
  const r = parseBrDecimal(text.replace(/^\s*R\$\s*/, ""));
  return r.ok ? r.value : null;
}

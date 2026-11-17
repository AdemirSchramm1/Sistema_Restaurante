import type { Deps, Repos } from "../ports";
import type { RequestContext } from "../context";
import { authorize } from "../shared";
import { isId } from "../form-input";
import { checkPeriod } from "../ordering/orders";
import type { CashCountRecord, CashEntryRecord, CashSessionStatus } from "./ports";
import { CASH_ENTITY, summarize } from "./shared";
import { can } from "@/domain/access/permissions";
import { outcomeOf, type ClosingOutcome } from "@/domain/cash/session";
import { receivedByMethod, steps, totalOf, type MethodAmount, type Step } from "@/domain/cash/summary";
import type { Decimal } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";

/** Relatório do turno e lista de turnos (spec 014, US5 e FR-006). */

export type CashSessionReport = {
  id: string;
  status: CashSessionStatus;
  businessDay: string;
  restaurantName: string;
  timezone: string;
  openedAt: Date;
  openedByName: string | null;
  openingFloat: Decimal;
  previousKept: Decimal | null;
  openingNote: string | null;
  closedAt: Date | null;
  closedByName: string | null;
  receivedByMethod: MethodAmount[];
  received: Decimal;
  removedFromOtherSessions: MethodAmount[];
  /** Taxa das contas fechadas no turno: congelada no fechamento; no turno aberto, a de agora. */
  serviceCharge: Decimal;
  entries: CashEntryRecord[];
  counts: CashCountRecord[];
  /** Passo a passo e esperado: nulos para quem não pode ver o esperado do turno aberto. */
  steps: Step[] | null;
  expected: Decimal | null;
  counted: Decimal | null;
  difference: Decimal | null;
  result: ClosingOutcome | null;
  kept: Decimal | null;
  /** Retirada do fechamento: contado − o que ficou na gaveta. */
  takenToSafe: Decimal | null;
  closeNote: string | null;
  serverNow: string;
};

/**
 * Turno fechado: tudo, para o gerente e o caixa. Turno aberto: parcial (sem contado e diferença), e
 * o esperado só para o gerente ou depois de uma contagem gravada (o caixa conta sem ver).
 */
export async function getCashSessionReport(
  deps: Deps,
  ctx: RequestContext,
  id: string,
): Promise<Result<CashSessionReport>> {
  if (!isId(id)) return err("NOT_FOUND");
  const allowed = await authorize(deps, ctx, "cash.history", CASH_ENTITY, id);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const session = await repos.cashSessions.get(id);
    if (!session) return err("NOT_FOUND");
    const summary = await summarize(repos, session);
    const counts = await repos.cashSessions.counts(id);
    const { restaurantName, timezone } = await repos.orderingSettings.get();
    const c = session.closing;
    const seesExpected = c !== null || can(ctx.roles, "cash.expected") || counts.length > 0;
    return ok({
      id: session.id,
      status: session.status,
      businessDay: session.businessDay,
      restaurantName,
      timezone,
      openedAt: session.openedAt,
      openedByName: session.openedByName,
      openingFloat: session.openingFloat,
      previousKept: session.previousKept,
      openingNote: session.openingNote,
      closedAt: c?.at ?? null,
      closedByName: c?.byName ?? null,
      receivedByMethod: summary.receivedByMethod,
      received: summary.received,
      removedFromOtherSessions: summary.removedFromOtherSessions,
      serviceCharge: c?.serviceCharge ?? (await repos.cashSessions.serviceCharge(id)),
      entries: summary.entries,
      counts,
      steps: seesExpected ? steps(summary.figures) : null,
      expected: seesExpected ? (c?.expected ?? summary.expected) : null,
      counted: c?.counted ?? null,
      difference: c?.difference ?? null,
      result: c ? outcomeOf(c.difference) : null,
      kept: c?.kept ?? null,
      takenToSafe: c ? c.counted.minus(c.kept) : null,
      closeNote: c?.note ?? null,
      serverNow: deps.clock.now().toISOString(),
    });
  });
}

export type CashSessionRow = {
  id: string;
  businessDay: string;
  status: CashSessionStatus;
  openedAt: Date;
  openedByName: string | null;
  closedAt: Date | null;
  closedByName: string | null;
  receivedByMethod: MethodAmount[];
  removedFromOtherSessions: MethodAmount[];
  received: Decimal;
  difference: Decimal | null;
  result: ClosingOutcome | null;
};

/** Turnos abertos no período (dias do restaurante, até 31), o mais recente primeiro. */
export async function listCashSessions(
  deps: Deps,
  ctx: RequestContext,
  input: { from: string; to: string },
): Promise<Result<{ sessions: CashSessionRow[]; timezone: string }>> {
  const allowed = await authorize(deps, ctx, "cash.history", CASH_ENTITY);
  if (!allowed.ok) return allowed;
  const period = checkPeriod(input.from, input.to);
  if (!period.ok) return period;
  return deps.tenant(ctx.restaurantId, async (repos) =>
    ok({
      sessions: await sessionRows(repos, input.from, input.to),
      timezone: (await repos.orderingSettings.get()).timezone,
    }),
  );
}

/** Turnos do período com o recebido de cada um: duas idas ao banco, qualquer que seja o número. */
export async function sessionRows(repos: Repos, from: string, to: string): Promise<CashSessionRow[]> {
  const sessions = await repos.cashSessions.list(from, to);
  const payments = await repos.cashSessions.payments(sessions.map((s) => s.id));
  return sessions.map((s, i): CashSessionRow => {
    const p = payments[i]!;
    const received = receivedByMethod(p.paid, p.removedInSession);
    return {
      id: s.id,
      businessDay: s.businessDay,
      status: s.status,
      openedAt: s.openedAt,
      openedByName: s.openedByName,
      closedAt: s.closing?.at ?? null,
      closedByName: s.closing?.byName ?? null,
      receivedByMethod: received,
      removedFromOtherSessions: p.removedFromOtherSessions,
      received: totalOf(received),
      difference: s.closing?.difference ?? null,
      result: s.closing ? outcomeOf(s.closing.difference) : null,
    };
  });
}

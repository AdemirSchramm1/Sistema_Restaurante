import type { Deps, Repos } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import { isId } from "../form-input";
import type { CashSessionRecord } from "./ports";
import { CASH_ENTITY, alreadyClosed, mayClose, summarize } from "./shared";
import { checkCount } from "@/domain/cash/count";
import { closingResult, outcomeOf, type ClosingOutcome } from "@/domain/cash/session";
import type { Decimal } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";

/**
 * Contar e fechar o caixa (spec 014, US4 e FR-005). O caixa conta sem ver o esperado: o esperado só
 * sai do servidor depois de uma contagem gravada, e toda contagem fica no relatório.
 */

/** Turno travado, aberto, de quem pode fechar; senão, o erro. */
async function lockForClosing(
  deps: Deps,
  ctx: RequestContext,
  repos: Repos,
  sessionId: string,
): Promise<Result<CashSessionRecord>> {
  const session = await repos.cashSessions.lock(sessionId);
  if (!session) return err("NOT_FOUND");
  if (session.closing) return alreadyClosed(session.closing, (await repos.orderingSettings.get()).timezone);
  if (!mayClose(ctx, session))
    return authorize(deps, ctx, "cash.close_any", CASH_ENTITY, session.id) as never;
  return ok(session);
}

export type CashClosingState = {
  sessionId: string;
  openedAt: Date;
  openedByName: string | null;
  timezone: string;
  /** Contagens já feitas, da primeira para a última. */
  counts: Decimal[];
  /** Última contagem; se entrou dinheiro depois dela, vem `outdated` e sem o esperado. */
  lastCount: {
    counted: Decimal;
    expected: Decimal | null;
    difference: Decimal | null;
    result: ClosingOutcome | null;
    outdated: boolean;
  } | null;
  /** Mesas com conta aberta: só avisa, não segura o fechamento. */
  openTabs: number;
};

/** O que a tela Fechar caixa mostra: nada do esperado antes de uma contagem que ainda vale. */
export async function getCashClosing(deps: Deps, ctx: RequestContext): Promise<Result<CashClosingState>> {
  const allowed = await authorize(deps, ctx, "cash.operate", CASH_ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const session = await repos.cashSessions.current();
    if (!session) return err("CASH_SESSION_REQUIRED", undefined, { action: "close" });
    if (!mayClose(ctx, session))
      return authorize(deps, ctx, "cash.close_any", CASH_ENTITY, session.id) as never;
    const counts = await repos.cashSessions.counts(session.id);
    const last = counts.at(-1) ?? null;
    const outdated = last !== null && last.sessionVersion !== session.version;
    const expected = last && !outdated ? (await summarize(repos, session)).expected : null;
    const difference = last && expected ? last.counted.minus(expected) : null;
    return ok({
      sessionId: session.id,
      openedAt: session.openedAt,
      openedByName: session.openedByName,
      timezone: (await repos.orderingSettings.get()).timezone,
      counts: counts.map((c) => c.counted),
      lastCount: last && {
        counted: last.counted,
        expected,
        difference,
        result: difference && outcomeOf(difference),
        outdated,
      },
      openTabs: await repos.tabs.countOpen(),
    });
  });
}

/**
 * Grava a contagem com a versão do turno e só então devolve o esperado e a diferença. Contar não
 * muda a versão: não entrou nem saiu dinheiro.
 */
export async function countCash(
  deps: Deps,
  ctx: RequestContext,
  input: { sessionId: string; counted: Decimal; denominations: Record<string, unknown> | null },
): Promise<Result<{ countId: string; expected: Decimal; difference: Decimal; result: ClosingOutcome }>> {
  if (!isId(input.sessionId)) return err("NOT_FOUND");
  const allowed = await authorize(deps, ctx, "cash.operate", CASH_ENTITY, input.sessionId);
  if (!allowed.ok) return allowed;
  const checked = checkCount(input);
  if (!checked.ok) return checked;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const locked = await lockForClosing(deps, ctx, repos, input.sessionId);
    if (!locked.ok) return locked;
    const session = locked.value;
    const audit = auditStamp(deps, ctx);
    const countId = deps.ids.next();
    await repos.cashSessions.insertCount(
      { id: countId, sessionId: session.id, ...checked.value, sessionVersion: session.version },
      audit,
    );
    await repos.audit.record({
      entity: CASH_ENTITY,
      entityId: session.id,
      action: "UPDATE",
      changes: { counted: { countId, counted: checked.value.counted.toFixed(2) } },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    const { expected } = await summarize(repos, session);
    const difference = checked.value.counted.minus(expected);
    return ok({ countId, expected, difference, result: outcomeOf(difference) });
  });
}

/**
 * Fecha o turno com a última contagem. Se entrou ou saiu dinheiro depois dela (a versão do turno
 * mudou), pede nova contagem. Grava o retrato; turno fechado não muda mais.
 */
export async function closeCashSession(
  deps: Deps,
  ctx: RequestContext,
  input: { sessionId: string; kept: Decimal | null; note: string | null },
): Promise<Result<{ sessionId: string; openTabs: number }>> {
  if (!isId(input.sessionId)) return err("NOT_FOUND");
  const allowed = await authorize(deps, ctx, "cash.operate", CASH_ENTITY, input.sessionId);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const locked = await lockForClosing(deps, ctx, repos, input.sessionId);
    if (!locked.ok) return locked;
    const session = locked.value;
    const count = await repos.cashSessions.lastCount(session.id);
    if (!count) return err("COUNT_REQUIRED");
    if (count.sessionVersion !== session.version) return err("COUNT_OUTDATED");

    const { expected } = await summarize(repos, session);
    const result = closingResult({ expected, counted: count.counted, kept: input.kept, note: input.note });
    if (!result.ok) return result;
    const snapshot = {
      expected,
      counted: count.counted,
      difference: result.value.difference,
      kept: result.value.kept,
      serviceCharge: await repos.cashSessions.serviceCharge(session.id),
      countId: count.id,
      note: result.value.note,
    };
    await repos.cashSessions.close(session.id, snapshot, auditStamp(deps, ctx));
    await repos.audit.record({
      entity: CASH_ENTITY,
      entityId: session.id,
      action: "UPDATE",
      changes: {
        closed: {
          expected: expected.toFixed(2),
          counted: count.counted.toFixed(2),
          difference: snapshot.difference.toFixed(2),
          kept: snapshot.kept.toFixed(2),
          serviceCharge: snapshot.serviceCharge.toFixed(2),
          note: snapshot.note,
        },
      },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok({ sessionId: session.id, openTabs: await repos.tabs.countOpen() });
  });
}

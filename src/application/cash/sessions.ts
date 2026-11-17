import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import { isId } from "../form-input";
import type { CashEntryRecord, CashSessionRecord } from "./ports";
import { CASH_ENTITY, mayClose, summarize } from "./shared";
import { can } from "@/domain/access/permissions";
import { checkOpening } from "@/domain/cash/session";
import type { MethodAmount } from "@/domain/cash/summary";
import { businessDay } from "@/domain/ordering/business-day";
import type { Decimal } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";

/** Turno do caixa: abrir e ver o que está aberto (spec 014, US1; contracts/use-cases.md). */

const HOUR = 3_600_000;

export type CurrentCashSession = {
  id: string;
  openedAt: Date;
  openedByName: string | null;
  openingFloat: Decimal;
  receivedByMethod: MethodAmount[];
  received: Decimal;
  /** Só para quem pode ver o esperado do turno aberto (gerente); para os outros nem sai do servidor. */
  expected: Decimal | null;
  entries: CashEntryRecord[];
  /** Horas inteiras desde a abertura: acima de 24 a tela avisa. */
  ageHours: number;
  version: number;
};

export type CashStatus = {
  session: CurrentCashSession | null;
  /** O que ficou na gaveta no último fechamento: é o troco sugerido na abertura. */
  previousKept: Decimal | null;
  timezone: string;
  /** Pode abrir, lançar sangria e reforço. */
  canOperate: boolean;
  /** Pode contar e fechar este turno (quem abriu, ou o gerente). */
  canClose: boolean;
  serverNow: string;
};

/** Situação do caixa para a tela Caixa: quem vê as contas vê se o caixa está aberto. */
export async function getCurrentCashSession(deps: Deps, ctx: RequestContext): Promise<Result<CashStatus>> {
  const allowed = await authorize(deps, ctx, "tab.read", CASH_ENTITY);
  if (!allowed.ok) return allowed;
  const canOperate = can(ctx.roles, "cash.operate");
  return deps.tenant<CashStatus>(ctx.restaurantId, async (repos) => {
    const { timezone } = await repos.orderingSettings.get();
    const now = deps.clock.now();
    const base = { timezone, canOperate, serverNow: now.toISOString() };
    const session = await repos.cashSessions.current();
    if (!session) {
      const last = await repos.cashSessions.lastClosed();
      return ok({ ...base, session: null, previousKept: last?.closing?.kept ?? null, canClose: false });
    }
    const summary = await summarize(repos, session);
    return ok({
      ...base,
      previousKept: session.previousKept,
      canClose: canOperate && mayClose(ctx, session),
      session: {
        id: session.id,
        openedAt: session.openedAt,
        openedByName: session.openedByName,
        openingFloat: session.openingFloat,
        receivedByMethod: summary.receivedByMethod,
        received: summary.received,
        expected: can(ctx.roles, "cash.expected") ? summary.expected : null,
        entries: summary.entries,
        ageHours: Math.floor((now.getTime() - session.openedAt.getTime()) / HOUR),
        version: session.version,
      },
    });
  });
}

export type OpenCashSessionInput = {
  openingFloat: Decimal;
  note: string | null;
  /** Gerado pela tela: o toque duplo devolve o mesmo turno. */
  clientRequestId: string;
};

/**
 * Abre o caixa com o troco (FR-001). O banco garante um turno aberto por restaurante: se duas telas
 * abrem ao mesmo tempo, uma abre e a outra vê quem abriu e quando.
 */
export async function openCashSession(
  deps: Deps,
  ctx: RequestContext,
  input: OpenCashSessionInput,
): Promise<Result<{ id: string }>> {
  if (!isId(input.clientRequestId)) return err("VALIDATION", "clientRequestId");
  const allowed = await authorize(deps, ctx, "cash.operate", CASH_ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const { timezone } = await repos.orderingSettings.get();
    /** O turno que já está aberto: o mesmo toque devolve o turno; outro vê quem abriu e quando. */
    const answerWith = (open: CashSessionRecord): Result<{ id: string }> =>
      open.clientRequestId === input.clientRequestId
        ? ok({ id: open.id })
        : err("CASH_SESSION_ALREADY_OPEN", undefined, {
            openedByName: open.openedByName,
            openedAt: open.openedAt.toISOString(),
            timezone,
          });
    const already = await repos.cashSessions.current();
    if (already) return answerWith(already);

    const last = await repos.cashSessions.lastClosed();
    const previousKept = last?.closing?.kept ?? null;
    const checked = checkOpening({ openingFloat: input.openingFloat, previousKept, note: input.note });
    if (!checked.ok) return checked;
    const audit = auditStamp(deps, ctx);
    const id = deps.ids.next();
    const opened = await repos.cashSessions.open(
      {
        id,
        businessDay: businessDay(audit.at, timezone),
        openingFloat: checked.value.openingFloat,
        previousKept,
        note: checked.value.note,
        clientRequestId: input.clientRequestId,
      },
      audit,
    );
    // Outra tela abriu entre a leitura e a gravação: responde com o turno dela.
    if (!opened.ok) return answerWith((await repos.cashSessions.current())!);
    await repos.audit.record({
      entity: CASH_ENTITY,
      entityId: id,
      action: "CREATE",
      changes: {
        opened: {
          openingFloat: checked.value.openingFloat.toFixed(2),
          previousKept: previousKept?.toFixed(2) ?? null,
          note: checked.value.note,
        },
      },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok({ id });
  });
}

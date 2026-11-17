import type { Repos } from "../ports";
import type { RequestContext } from "../context";
import type { CashClosing, CashSessionRecord } from "./ports";
import { can } from "@/domain/access/permissions";
import { sessionSummary } from "@/domain/cash/summary";
import { err } from "@/domain/shared/result";

/** O que os casos de uso do caixa do dia (spec 014) têm em comum. */

export const CASH_ENTITY = "cash_session";

/** Lançamentos e somas do turno, com o esperado refeito a partir das linhas (FR-004). */
export async function summarize(repos: Repos, session: CashSessionRecord) {
  const [payments] = await repos.cashSessions.payments([session.id]);
  const entries = await repos.cashSessions.entries(session.id);
  return {
    entries,
    ...sessionSummary({
      openingFloat: session.openingFloat,
      ...payments!,
      entries: entries.map((e) => ({ kind: e.kind, amount: e.amount, removed: e.removedAt !== null })),
    }),
  };
}

/** Contar e fechar: quem abriu o turno, ou quem pode fechar o turno de outra pessoa (gerente). */
export const mayClose = (ctx: RequestContext, session: CashSessionRecord) =>
  session.openedBy === ctx.userId || can(ctx.roles, "cash.close_any");

/** "O caixa já foi fechado por Ana às 23:10." */
export const alreadyClosed = (closing: CashClosing, timezone: string) =>
  err("CASH_SESSION_ALREADY_CLOSED", undefined, {
    closedByName: closing.byName,
    closedAt: closing.at.toISOString(),
    timezone,
  });

import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import { isId } from "../form-input";
import type { CashEntryRecord } from "./ports";
import { CASH_ENTITY, summarize } from "./shared";
import {
  checkSupply,
  checkSupplyRemoval,
  checkWithdrawal,
  isEntryKind,
  type EntryKind,
} from "@/domain/cash/entries";
import type { Decimal } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";

/** Sangria e reforço (spec 014, US3 e FR-003): só inserção; tirar é outra linha. */

export type AddCashEntryInput = {
  kind: EntryKind;
  amount: Decimal;
  /** Motivo da sangria; o reforço não tem. */
  reason: unknown;
  note: string | null;
  /** Gerado pela tela: o toque duplo devolve o mesmo lançamento. */
  clientRequestId: string;
};

/**
 * Lança no turno travado: duas sangrias ao mesmo tempo nunca passam do dinheiro esperado, porque a
 * segunda espera a primeira e confere o esperado depois dela.
 */
export async function addCashEntry(
  deps: Deps,
  ctx: RequestContext,
  input: AddCashEntryInput,
): Promise<Result<{ entryId: string }>> {
  if (!isEntryKind(input.kind)) return err("VALIDATION", "kind");
  if (!isId(input.clientRequestId)) return err("VALIDATION", "clientRequestId");
  const allowed = await authorize(deps, ctx, "cash.operate", CASH_ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const session = await repos.cashSessions.lockOpen();
    if (!session) return err("CASH_SESSION_REQUIRED", undefined, { action: "entry" });
    const same = await repos.cashSessions.entryByClientRequest(session.id, input.clientRequestId);
    if (same) return ok({ entryId: same.id });

    const withdrawal =
      input.kind === "WITHDRAWAL" ? checkWithdrawal(input, (await summarize(repos, session)).expected) : null;
    if (withdrawal && !withdrawal.ok) return withdrawal;
    const checked = withdrawal ?? checkSupply(input);
    if (!checked.ok) return checked;
    const reason = withdrawal?.value.reason ?? null;
    const audit = auditStamp(deps, ctx);
    const entryId = deps.ids.next();
    await repos.cashSessions.insertEntry(
      {
        id: entryId,
        sessionId: session.id,
        kind: input.kind,
        amount: checked.value.amount,
        reason,
        note: checked.value.note,
        clientRequestId: input.clientRequestId,
      },
      audit,
    );
    await repos.cashSessions.bumpVersion(session.id, audit);
    await repos.audit.record({
      entity: CASH_ENTITY,
      entityId: session.id,
      action: "UPDATE",
      changes: {
        entryAdded: {
          entryId,
          kind: input.kind,
          amount: checked.value.amount.toFixed(2),
          reason,
          note: checked.value.note,
        },
      },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok({ entryId });
  });
}

/**
 * Tira uma sangria ou um reforço lançado errado, só no turno aberto: continua na lista, riscado, e
 * deixa de contar no esperado. Tirar um reforço não pode deixar o esperado negativo.
 */
export async function removeCashEntry(
  deps: Deps,
  ctx: RequestContext,
  input: { entryId: string },
): Promise<Result<void>> {
  if (!isId(input.entryId)) return err("NOT_FOUND");
  const allowed = await authorize(deps, ctx, "cash.operate", CASH_ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const found = await repos.cashSessions.getEntry(input.entryId);
    if (!found) return err("NOT_FOUND");
    const session = await repos.cashSessions.lock(found.sessionId);
    if (session!.status !== "OPEN") return err("CASH_SESSION_CLOSED");
    // Relido depois da trava: outra tela pode ter tirado um instante antes.
    const entry = (await repos.cashSessions.getEntry(input.entryId))!;
    if (entry.removedAt) return err("ALREADY_REMOVED", undefined, { entry: true });
    if (entry.kind === "SUPPLY") {
      const allowedRemoval = checkSupplyRemoval(entry.amount, (await summarize(repos, session!)).expected);
      if (!allowedRemoval.ok) return allowedRemoval;
    }
    const audit = auditStamp(deps, ctx);
    await repos.cashSessions.removeEntry(entry.id, deps.ids.next(), audit);
    await repos.cashSessions.bumpVersion(session!.id, audit);
    await repos.audit.record({
      entity: CASH_ENTITY,
      entityId: session!.id,
      action: "UPDATE",
      changes: { entryRemoved: { entryId: entry.id, kind: entry.kind, amount: entry.amount.toFixed(2) } },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok(undefined);
  });
}

/** Lançamento para o comprovante impresso (US3-4). */
export async function getCashEntry(
  deps: Deps,
  ctx: RequestContext,
  id: string,
): Promise<Result<{ entry: CashEntryRecord; restaurantName: string; timezone: string }>> {
  if (!isId(id)) return err("NOT_FOUND");
  const allowed = await authorize(deps, ctx, "cash.operate", CASH_ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const entry = await repos.cashSessions.getEntry(id);
    if (!entry) return err("NOT_FOUND");
    const { restaurantName, timezone } = await repos.orderingSettings.get();
    return ok({ entry, restaurantName, timezone });
  });
}

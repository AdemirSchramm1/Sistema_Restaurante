import type { Deps, Repos } from "../ports";
import type { RequestContext } from "../context";
import { authorize } from "../shared";
import type {
  AdjustmentRequestRecord,
  ItemListRow,
  MovementFilter,
  MovementRecord,
  NewMovement,
} from "./ports";
import {
  checkAdjustmentDecision,
  planAdjustmentApproval,
  planAdjustmentRequest,
  planLoss,
  planPurchase,
  planReversal,
  type AdjustmentStatus,
  type PlannedMovement,
  type PurchaseInput,
} from "@/domain/inventory/movement";
import { reasonById } from "@/domain/inventory/movement-reasons";
import type { UnitCode } from "@/domain/inventory/units";
import type { Decimal } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";

/** Livro de movimentações (specs/004-entradas-perdas-saldo). Cada caso de uso roda numa transação. */

const ENTITY = "stock_movement";

type Common = { occurredAt: Date; notes: string | null; idempotencyKey: string | null };

const cleanNotes = (n: string | null) => (n && n.trim() ? n.trim().slice(0, 500) : null);

/** Grava a linha, o saldo e a auditoria; trava a medida do item. */
async function write(
  deps: Deps,
  ctx: RequestContext,
  repos: Repos,
  base: Omit<NewMovement, "id" | "recordedAt" | "recordedBy" | keyof PlannedMovement>,
  plan: PlannedMovement,
): Promise<string> {
  const id = deps.ids.next();
  const at = deps.clock.now();
  await repos.movements.insert({ ...base, ...plan, id, recordedAt: at, recordedBy: ctx.userId });
  await repos.movements.addToBalance(base.itemId, plan.quantity, at);
  await repos.movements.lockStockUnit(base.itemId, at);
  await repos.audit.record({
    entity: ENTITY,
    entityId: id,
    action: "CREATE",
    changes: { type: base.type, itemId: base.itemId, quantity: plan.quantity.toString() },
    userId: ctx.userId,
    origin: ctx.origin,
  });
  return id;
}

async function replayed(repos: Repos, key: string | null) {
  return key ? repos.movements.findByIdempotencyKey(key) : null;
}

export type PurchaseCommand = Common & {
  itemId: string;
  /** De quem foi a compra (spec 007). Opcional. */
  supplierId?: string | null;
  quantity: Decimal;
  /** `SUPPLIER_PACKAGE`: a embalagem do fornecedor escolhido para este item. */
  unit: UnitCode | "PACKAGE" | "SUPPLIER_PACKAGE";
  totalPaid: Decimal;
};

/** Fornecedor da compra: existe, não está bloqueado e, se pedido, tem embalagem para o item. */
async function resolveSupplier(
  repos: Repos,
  cmd: PurchaseCommand,
): Promise<Result<{ supplierId: string | null; unit: PurchaseInput["unit"] }>> {
  const supplierId = cmd.supplierId ?? null;
  if (!supplierId) {
    if (cmd.unit === "SUPPLIER_PACKAGE") return err("UNKNOWN_UNIT", "unit");
    return ok({ supplierId, unit: cmd.unit });
  }
  const supplier = await repos.suppliers.get(supplierId);
  if (!supplier) return err("NOT_FOUND", "supplierId");
  if (!supplier.active) return err("SUPPLIER_BLOCKED", "supplierId");
  if (cmd.unit !== "SUPPLIER_PACKAGE") return ok({ supplierId, unit: cmd.unit });
  const offer = await repos.suppliers.findOffer(supplierId, cmd.itemId);
  if (!offer?.packageLabel || !offer.packageQuantity) return err("UNKNOWN_UNIT", "unit");
  return ok({
    supplierId,
    unit: { packageLabel: offer.packageLabel, packageQuantity: offer.packageQuantity },
  });
}

/** Compra: saldo sobe, custo médio e último custo mudam (US1). */
export async function registerPurchase(
  deps: Deps,
  ctx: RequestContext,
  cmd: PurchaseCommand,
): Promise<Result<{ movementId: string }>> {
  const allowed = await authorize(deps, ctx, "movement.purchase", ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const again = await replayed(repos, cmd.idempotencyKey);
    if (again) return ok({ movementId: again });
    const item = await repos.movements.lockItem(cmd.itemId);
    if (!item) return err("NOT_FOUND", "itemId");
    const supplier = await resolveSupplier(repos, cmd);
    if (!supplier.ok) return supplier;
    const plan = planPurchase(item, { ...cmd, unit: supplier.value.unit }, deps.clock.now());
    if (!plan.ok) return plan;
    const { newAverageCost, newLastCost, ...line } = plan.value;
    const movementId = await write(
      deps,
      ctx,
      repos,
      {
        type: "PURCHASE",
        itemId: item.id,
        supplierId: supplier.value.supplierId,
        reasonId: null,
        notes: cleanNotes(cmd.notes),
        occurredAt: cmd.occurredAt,
        reversesId: null,
        approvedBy: null,
        idempotencyKey: cmd.idempotencyKey,
      },
      line,
    );
    await repos.movements.setCosts(item.id, {
      averageCost: newAverageCost,
      lastCost: newLastCost,
      at: deps.clock.now(),
    });
    return ok({ movementId });
  });
}

export type LossCommand = Common & { itemId: string; quantity: Decimal; unit: UnitCode; reasonId: string };

/** Perda com motivo; sai pelo custo médio (US2). */
export async function registerLoss(
  deps: Deps,
  ctx: RequestContext,
  cmd: LossCommand,
): Promise<Result<{ movementId: string }>> {
  const allowed = await authorize(deps, ctx, "movement.loss", ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const again = await replayed(repos, cmd.idempotencyKey);
    if (again) return ok({ movementId: again });
    const item = await repos.movements.lockItem(cmd.itemId);
    if (!item) return err("NOT_FOUND", "itemId");
    const plan = planLoss(item, { ...cmd, reason: reasonById(cmd.reasonId) }, deps.clock.now());
    if (!plan.ok) return plan;
    const movementId = await write(
      deps,
      ctx,
      repos,
      {
        type: "LOSS",
        itemId: item.id,
        reasonId: cmd.reasonId,
        notes: cleanNotes(cmd.notes),
        occurredAt: cmd.occurredAt,
        reversesId: null,
        approvedBy: null,
        idempotencyKey: cmd.idempotencyKey,
      },
      plan.value,
    );
    return ok({ movementId });
  });
}

export type AdjustmentRequestCommand = {
  itemId: string;
  countedQuantity: Decimal;
  unit: UnitCode;
  reasonId: string;
  notes: string | null;
};

/** Pedido de acerto: guarda a diferença; o saldo só muda quando outro gerente aprova (US3). */
export async function requestAdjustment(
  deps: Deps,
  ctx: RequestContext,
  cmd: AdjustmentRequestCommand,
): Promise<Result<{ requestId: string; difference: Decimal }>> {
  const allowed = await authorize(deps, ctx, "adjustment.request", "adjustment_request");
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const item = await repos.movements.lockItem(cmd.itemId);
    if (!item) return err("NOT_FOUND", "itemId");
    const plan = planAdjustmentRequest(item, { ...cmd, reason: reasonById(cmd.reasonId) });
    if (!plan.ok) return plan;
    const id = deps.ids.next();
    const at = deps.clock.now();
    await repos.movements.insertRequest({
      id,
      itemId: item.id,
      ...plan.value,
      reasonId: cmd.reasonId,
      notes: cleanNotes(cmd.notes),
      by: ctx.userId,
      at,
    });
    await repos.audit.record({
      entity: "adjustment_request",
      entityId: id,
      action: "CREATE",
      changes: { itemId: item.id, difference: plan.value.difference.toString() },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok({ requestId: id, difference: plan.value.difference });
  });
}

/** Aprova (lança a diferença) ou recusa. Nunca por quem pediu (constituição V). */
export async function decideAdjustment(
  deps: Deps,
  ctx: RequestContext,
  requestId: string,
  approve: boolean,
  notes: string | null,
): Promise<Result<{ movementId: string | null }>> {
  const allowed = await authorize(deps, ctx, "adjustment.approve", "adjustment_request", requestId);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const req = await repos.movements.lockRequest(requestId);
    if (!req) return err("NOT_FOUND");
    const decision = checkAdjustmentDecision(req, ctx.userId);
    if (!decision.ok) return decision;
    const at = deps.clock.now();
    let movementId: string | null = null;
    if (approve) {
      const item = await repos.movements.lockItem(req.itemId);
      if (!item) return err("NOT_FOUND");
      const plan = planAdjustmentApproval(item, req.difference);
      if (!plan.ok) return plan;
      const id = deps.ids.next();
      await repos.movements.insert({
        ...plan.value,
        id,
        type: "ADJUSTMENT",
        itemId: item.id,
        reasonId: req.reasonId,
        notes: req.notes,
        occurredAt: req.requestedAt,
        reversesId: null,
        approvedBy: ctx.userId,
        idempotencyKey: null,
        // Quem lançou é quem pediu; quem aprovou fica em approved_by.
        recordedBy: req.requestedBy,
        recordedAt: at,
      });
      await repos.movements.addToBalance(item.id, plan.value.quantity, at);
      await repos.movements.lockStockUnit(item.id, at);
      movementId = id;
    }
    await repos.movements.closeRequest(requestId, {
      status: approve ? "APPROVED" : "REJECTED",
      by: ctx.userId,
      at,
      notes: cleanNotes(notes),
      movementId,
    });
    await repos.audit.record({
      entity: "adjustment_request",
      entityId: requestId,
      action: "UPDATE",
      changes: { status: ["PENDING", approve ? "APPROVED" : "REJECTED"] },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok({ movementId });
  });
}

/** Quem pediu cancela o próprio pedido pendente. */
export async function cancelAdjustment(
  deps: Deps,
  ctx: RequestContext,
  requestId: string,
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "adjustment.request", "adjustment_request", requestId);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const req = await repos.movements.lockRequest(requestId);
    if (!req) return err("NOT_FOUND");
    if (req.status !== "PENDING") return err("REQUEST_NOT_PENDING");
    if (req.requestedBy !== ctx.userId) return err("FORBIDDEN");
    await repos.movements.closeRequest(requestId, {
      status: "CANCELLED",
      by: ctx.userId,
      at: deps.clock.now(),
      notes: null,
      movementId: null,
    });
    return ok(undefined);
  });
}

export type ReversalCommand = { reasonId: string; notes: string | null; idempotencyKey: string | null };

/** Estorno: movimentação inversa ligada à original, uma vez só (US5). */
export async function reverseMovement(
  deps: Deps,
  ctx: RequestContext,
  movementId: string,
  cmd: ReversalCommand,
): Promise<Result<{ movementId: string }>> {
  const allowed = await authorize(deps, ctx, "movement.reverse", ENTITY, movementId);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const again = await replayed(repos, cmd.idempotencyKey);
    if (again) return ok({ movementId: again });
    const original = await repos.movements.get(movementId);
    if (!original) return err("NOT_FOUND");
    const item = await repos.movements.lockItem(original.itemId);
    if (!item) return err("NOT_FOUND");
    // Relê depois de travar o item: outro estorno pode ter acabado de entrar.
    const fresh = (await repos.movements.get(movementId))!;
    const plan = planReversal(
      { ...fresh, reversed: fresh.reversedById !== null },
      item,
      reasonById(cmd.reasonId),
    );
    if (!plan.ok) return plan;
    const { newAverageCost, ...line } = plan.value;
    const id = await write(
      deps,
      ctx,
      repos,
      {
        type: "REVERSAL",
        itemId: item.id,
        reasonId: cmd.reasonId,
        notes: cleanNotes(cmd.notes),
        occurredAt: deps.clock.now(),
        reversesId: movementId,
        approvedBy: null,
        idempotencyKey: cmd.idempotencyKey,
      },
      line,
    );
    if (newAverageCost)
      await repos.movements.setCosts(item.id, { averageCost: newAverageCost, at: deps.clock.now() });
    return ok({ movementId: id });
  });
}

/** Itens ativos para o formulário de lançamento: todos, sem paginação. */
export async function movementItemOptions(deps: Deps, ctx: RequestContext): Promise<Result<ItemListRow[]>> {
  const allowed = await authorize(deps, ctx, "catalog.read", ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const r = await repos.items.list({ status: "active", page: 1, pageSize: OPTIONS_LIMIT });
    return ok(r.rows);
  });
}
const OPTIONS_LIMIT = 10_000;

export type MovementView = MovementRecord & { reasonLabel: string | null };

export async function listMovements(
  deps: Deps,
  ctx: RequestContext,
  filter: MovementFilter,
): Promise<Result<MovementView[]>> {
  const allowed = await authorize(deps, ctx, "catalog.read", ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) =>
    ok(
      (await repos.movements.list(filter)).map((m) => ({
        ...m,
        reasonLabel: m.reasonId ? (reasonById(m.reasonId)?.label ?? null) : null,
      })),
    ),
  );
}

export type AdjustmentRequestView = AdjustmentRequestRecord & { reasonLabel: string };

export async function listAdjustmentRequests(
  deps: Deps,
  ctx: RequestContext,
  filter: { status: AdjustmentStatus | "ALL" },
): Promise<Result<AdjustmentRequestView[]>> {
  const allowed = await authorize(deps, ctx, "catalog.read", "adjustment_request");
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) =>
    ok(
      (await repos.movements.listRequests(filter.status)).map((r) => ({
        ...r,
        reasonLabel: reasonById(r.reasonId)?.label ?? "",
      })),
    ),
  );
}

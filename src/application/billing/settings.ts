import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import { checkServiceRate } from "@/domain/billing/service-charge";
import type { Decimal } from "@/domain/shared/decimal";
import { ok, type Result } from "@/domain/shared/result";

/** Taxa de serviço do restaurante (spec 011, FR-004): vale para as contas que abrirem depois. */

export async function getServiceChargeSettings(
  deps: Deps,
  ctx: RequestContext,
): Promise<Result<{ rate: Decimal | null; version: number }>> {
  const allowed = await authorize(deps, ctx, "tab.read", "restaurant");
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const s = await repos.billingSettings.get();
    return ok({ rate: s.serviceChargeRate, version: s.version });
  });
}

/** 0 a 20%, até 2 casas, ou `null` (desligada). Só o gerente. */
export async function setServiceChargeRate(
  deps: Deps,
  ctx: RequestContext,
  input: { rate: Decimal | null; version: number },
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "tab.settings", "restaurant", ctx.restaurantId);
  if (!allowed.ok) return allowed;
  const rate = checkServiceRate(input.rate);
  if (!rate.ok) return rate;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const current = await repos.billingSettings.get();
    const r = await repos.billingSettings.setServiceChargeRate(
      rate.value,
      input.version,
      auditStamp(deps, ctx),
    );
    if (!r.ok) return r;
    const before = current.serviceChargeRate?.toFixed(2) ?? null;
    const after = rate.value?.toFixed(2) ?? null;
    if (before !== after)
      await repos.audit.record({
        entity: "restaurant",
        entityId: ctx.restaurantId,
        action: "UPDATE",
        changes: { serviceChargeRate: [before, after] },
        userId: ctx.userId,
        origin: ctx.origin,
      });
    return ok(undefined);
  });
}

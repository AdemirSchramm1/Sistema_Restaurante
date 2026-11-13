import type { Deps, Repos } from "../ports";
import type { RequestContext } from "../context";
import { authorize, auditStamp } from "../shared";
import type { SupplierFilter, SupplierItemRecord, SupplierListRow } from "./ports";
import {
  cheapestOffer,
  pricePerUnit,
  validateSupplier,
  validateSupplierItem,
  WEEKDAY_LABELS,
  type Supplier,
  type SupplierData,
  type SupplierItemData,
} from "@/domain/suppliers/supplier";
import { formatCnpj } from "@/domain/suppliers/cnpj";
import { normalizeDescription } from "@/domain/inventory/description";
import { formatBrDecimal, formatBrl, type Decimal } from "@/domain/shared/decimal";
import { diffFields } from "@/domain/shared/audit";
import { err, ok, type Result } from "@/domain/shared/result";

/** Fornecedores (specs/007-fornecedores). */

const ENTITY = "supplier";

/** Forma gravada na auditoria: legível, sem ids. */
function auditView(s: SupplierData) {
  return {
    name: s.name,
    legalName: s.legalName,
    cnpj: s.cnpj ? formatCnpj(s.cnpj) : null,
    contactName: s.contactName,
    phone: s.phone,
    email: s.email,
    deliveryDays: s.deliveryDays.map((d) => WEEKDAY_LABELS[d]).join(", ") || null,
    leadTimeDays: s.leadTimeDays,
    minOrderValue: s.minOrderValue ? formatBrDecimal(s.minOrderValue, { minPlaces: 2, maxPlaces: 2 }) : null,
    paymentTerms: s.paymentTerms,
    notes: s.notes,
  };
}

/** "Tomate italiano: Caixa 18 kg a R$ 90,00 (preferido)". */
function offerText(
  itemName: string,
  unit: string,
  o: Pick<SupplierItemData, "packageLabel" | "packageQuantity" | "price" | "preferred">,
) {
  const money = formatBrl(o.price, { maxPlaces: 4 });
  const per = o.packageLabel
    ? `${o.packageLabel} ${formatBrDecimal(o.packageQuantity!)} ${unit} a ${money}`
    : `${money}/${unit}`;
  return `${itemName}: ${per}${o.preferred ? " (preferido)" : ""}`;
}

async function checkUnique(repos: Repos, data: SupplierData, normalized: string, exceptId?: string) {
  if (data.cnpj) {
    const other = await repos.suppliers.findByCnpj(data.cnpj, exceptId);
    if (other) return err("CNPJ_IN_USE", "cnpj", { existingName: other.name });
  }
  if (await repos.suppliers.findActiveByName(normalized, exceptId)) return err("NAME_IN_USE", "name");
  return ok(undefined);
}

export async function createSupplier(
  deps: Deps,
  ctx: RequestContext,
  input: SupplierData,
): Promise<Result<{ id: string }>> {
  const allowed = await authorize(deps, ctx, "supplier.write", ENTITY);
  if (!allowed.ok) return allowed;
  const valid = validateSupplier(input);
  if (!valid.ok) return valid;
  const data = valid.value;

  return deps.tenant(ctx.restaurantId, async (repos) => {
    const normalized = normalizeDescription(data.name);
    const unique = await checkUnique(repos, data, normalized);
    if (!unique.ok) return unique;
    const id = deps.ids.next();
    const inserted = await repos.suppliers.insert(
      { ...data, id, nameNormalized: normalized },
      auditStamp(deps, ctx),
    );
    if (!inserted.ok) return inserted;
    await repos.audit.record({
      entity: ENTITY,
      entityId: id,
      action: "CREATE",
      changes: diffFields(null, auditView(data)),
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok({ id });
  });
}

export async function updateSupplier(
  deps: Deps,
  ctx: RequestContext,
  id: string,
  version: number,
  input: SupplierData,
): Promise<Result<{ version: number }>> {
  const allowed = await authorize(deps, ctx, "supplier.write", ENTITY, id);
  if (!allowed.ok) return allowed;
  const valid = validateSupplier(input);
  if (!valid.ok) return valid;
  const data = valid.value;

  return deps.tenant(ctx.restaurantId, async (repos) => {
    const current = await repos.suppliers.get(id);
    if (!current) return err("NOT_FOUND");
    if (current.version !== version) return err("STALE_RECORD");
    const normalized = normalizeDescription(data.name);
    const unique = await checkUnique(repos, data, normalized, id);
    if (!unique.ok && (unique.error.code === "CNPJ_IN_USE" || current.active)) return unique;

    const updated = await repos.suppliers.update(
      id,
      { ...data, nameNormalized: normalized },
      version,
      auditStamp(deps, ctx),
    );
    if (!updated.ok) return updated;
    const changes = diffFields(auditView(current), auditView(data));
    if (Object.keys(changes).length)
      await repos.audit.record({
        entity: ENTITY,
        entityId: id,
        action: "UPDATE",
        changes,
        userId: ctx.userId,
        origin: ctx.origin,
      });
    return ok({ version: version + 1 });
  });
}

/** Bloqueia (`active` falso) ou desbloqueia. Nunca apaga (US5). */
export async function setSupplierActive(
  deps: Deps,
  ctx: RequestContext,
  id: string,
  version: number,
  active: boolean,
): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "supplier.write", ENTITY, id);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const current = await repos.suppliers.get(id);
    if (!current) return err("NOT_FOUND");
    if (active && !current.active) {
      const same = await repos.suppliers.findActiveByName(normalizeDescription(current.name), id);
      if (same) return err("NAME_IN_USE", "name");
    }
    const r = await repos.suppliers.setActive(id, active, version, auditStamp(deps, ctx));
    if (!r.ok) return r;
    await repos.audit.record({
      entity: ENTITY,
      entityId: id,
      action: active ? "REACTIVATE" : "DEACTIVATE",
      changes: { active: [!active, active] },
      userId: ctx.userId,
      origin: ctx.origin,
    });
    return ok(undefined);
  });
}

export type SupplierItemView = SupplierItemRecord & { pricePerUnit: Decimal };
export type OfferView = SupplierItemView & { cheapest: boolean };

const withUnitPrice = (r: SupplierItemRecord): SupplierItemView => ({ ...r, pricePerUnit: pricePerUnit(r) });

export async function getSupplier(
  deps: Deps,
  ctx: RequestContext,
  id: string,
): Promise<Result<{ supplier: Supplier; items: SupplierItemView[] }>> {
  const allowed = await authorize(deps, ctx, "catalog.read", ENTITY, id);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const supplier = await repos.suppliers.get(id);
    if (!supplier) return err("NOT_FOUND");
    const items = await repos.suppliers.items({ supplierId: id });
    return ok({ supplier, items: items.map(withUnitPrice) });
  });
}

export async function listSuppliers(
  deps: Deps,
  ctx: RequestContext,
  filter: SupplierFilter,
): Promise<Result<SupplierListRow[]>> {
  const allowed = await authorize(deps, ctx, "catalog.read", ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => ok(await repos.suppliers.list(filter)));
}

/** Quem vende o item, com o preço por medida e o mais barato (US3). */
export async function listItemOffers(
  deps: Deps,
  ctx: RequestContext,
  itemId: string,
): Promise<Result<OfferView[]>> {
  const allowed = await authorize(deps, ctx, "catalog.read", ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const offers = (await repos.suppliers.items({ itemId })).map(withUnitPrice);
    const cheapest = cheapestOffer(offers);
    return ok(offers.map((o) => ({ ...o, cheapest: o.id === cheapest })));
  });
}

/** Fornecedores ativos e suas embalagens, para o lançamento de compra (US4). */
export async function purchaseSupplierOptions(deps: Deps, ctx: RequestContext) {
  const allowed = await authorize(deps, ctx, "catalog.read", ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => ok(await repos.suppliers.activeWithPackages()));
}

async function recordItemChange(
  deps: Deps,
  ctx: RequestContext,
  repos: Repos,
  supplierId: string,
  before: string | null,
  after: string | null,
) {
  await repos.audit.record({
    entity: ENTITY,
    entityId: supplierId,
    action: "UPDATE",
    changes: { item: [before, after] },
    userId: ctx.userId,
    origin: ctx.origin,
  });
}

export async function addSupplierItem(
  deps: Deps,
  ctx: RequestContext,
  supplierId: string,
  input: SupplierItemData,
): Promise<Result<{ id: string }>> {
  const allowed = await authorize(deps, ctx, "supplier.write", ENTITY, supplierId);
  if (!allowed.ok) return allowed;
  const valid = validateSupplierItem(input);
  if (!valid.ok) return valid;
  const data = valid.value;

  return deps.tenant(ctx.restaurantId, async (repos) => {
    const supplier = await repos.suppliers.get(supplierId);
    if (!supplier) return err("NOT_FOUND");
    const item = await repos.items.get(data.itemId);
    if (!item) return err("NOT_FOUND", "itemId");
    if (!item.active) return err("ITEM_INACTIVE", "itemId");
    if (await repos.suppliers.findOffer(supplierId, data.itemId))
      return err("SUPPLIER_ITEM_DUPLICATE", "itemId");

    const id = deps.ids.next();
    const stamp = auditStamp(deps, ctx);
    if (data.preferred) await repos.suppliers.clearPreferred(data.itemId, id, stamp);
    const inserted = await repos.suppliers.insertItem({ ...data, id, supplierId }, stamp);
    if (!inserted.ok) return inserted;
    await recordItemChange(
      deps,
      ctx,
      repos,
      supplierId,
      null,
      offerText(item.description, item.stockUnit, data),
    );
    return ok({ id });
  });
}

export async function updateSupplierItem(
  deps: Deps,
  ctx: RequestContext,
  id: string,
  version: number,
  input: Omit<SupplierItemData, "itemId">,
): Promise<Result<{ version: number }>> {
  const allowed = await authorize(deps, ctx, "supplier.write", ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const current = await repos.suppliers.getItem(id);
    if (!current) return err("NOT_FOUND");
    if (current.version !== version) return err("STALE_RECORD");
    const valid = validateSupplierItem({ ...input, itemId: current.itemId });
    if (!valid.ok) return valid;
    const { itemId: _i, ...data } = valid.value;

    const stamp = auditStamp(deps, ctx);
    if (data.preferred && !current.preferred) await repos.suppliers.clearPreferred(current.itemId, id, stamp);
    const updated = await repos.suppliers.updateItem(id, data, version, stamp);
    if (!updated.ok) return updated;
    const before = offerText(current.itemName, current.stockUnit, current);
    const after = offerText(current.itemName, current.stockUnit, data);
    if (before !== after) await recordItemChange(deps, ctx, repos, current.supplierId, before, after);
    return ok({ version: version + 1 });
  });
}

export async function removeSupplierItem(deps: Deps, ctx: RequestContext, id: string): Promise<Result<void>> {
  const allowed = await authorize(deps, ctx, "supplier.write", ENTITY);
  if (!allowed.ok) return allowed;
  return deps.tenant(ctx.restaurantId, async (repos) => {
    const current = await repos.suppliers.getItem(id);
    if (!current) return err("NOT_FOUND");
    await repos.suppliers.deleteItem(id);
    await recordItemChange(
      deps,
      ctx,
      repos,
      current.supplierId,
      offerText(current.itemName, current.stockUnit, current),
      null,
    );
    return ok(undefined);
  });
}

import { and, asc, eq, ilike, ne, or, sql, type SQL } from "drizzle-orm";
import type { SupplierItemRecord, SupplierRepo } from "@/application/suppliers/ports";
import type { Supplier, SupplierData } from "@/domain/suppliers/supplier";
import { normalizeDescription } from "@/domain/inventory/description";
import { normalizeCnpj } from "@/domain/suppliers/cnpj";
import { d } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";
import type { Tx } from "../db";
import { items, supplierItems, suppliers } from "../schema";
import { dec, isUniqueViolation, str, UNIT_CODE_BY_ID, withSavepoint } from "./util";

type Audit = { at: Date; by: string | null };

function toRow(s: SupplierData & { nameNormalized: string }) {
  return {
    name: s.name,
    nameNormalized: s.nameNormalized,
    legalName: s.legalName,
    cnpj: s.cnpj,
    contactName: s.contactName,
    phone: s.phone,
    email: s.email,
    deliveryDays: s.deliveryDays,
    leadTimeDays: s.leadTimeDays,
    minOrderValue: str(s.minOrderValue),
    paymentTerms: s.paymentTerms,
    notes: s.notes,
  };
}

const escapeLike = (s: string) => s.replace(/[%_\\]/g, "\\$&");

/** Violação de unicidade → erro de domínio. */
async function guarded(tx: Tx, fn: () => Promise<Result<void>>): Promise<Result<void>> {
  try {
    return await withSavepoint(tx, fn);
  } catch (e) {
    if (isUniqueViolation(e, "suppliers_cnpj")) return err("CNPJ_IN_USE", "cnpj");
    if (isUniqueViolation(e, "suppliers_active_name")) return err("NAME_IN_USE", "name");
    if (isUniqueViolation(e, "supplier_items_supplier_item")) return err("SUPPLIER_ITEM_DUPLICATE", "itemId");
    throw e;
  }
}

export function supplierRepository(tx: Tx, restaurantId: string): SupplierRepo {
  async function optimistic(
    table: typeof suppliers | typeof supplierItems,
    id: string,
    version: number,
    set: Record<string, unknown>,
    audit: Audit,
  ): Promise<Result<void>> {
    const r = await tx
      .update(table)
      .set({ ...set, version: version + 1, updatedAt: audit.at, updatedBy: audit.by })
      .where(and(eq(table.id, id), eq(table.version, version)))
      .returning({ id: table.id });
    if (r.length) return ok(undefined);
    const exists = await tx.select({ id: table.id }).from(table).where(eq(table.id, id));
    return exists.length ? err("STALE_RECORD") : err("NOT_FOUND");
  }

  /** Última compra não estornada deste fornecedor para este item. */
  const lastPurchase = (column: "occurred_at" | "unit_cost") =>
    sql.raw(`(select m.${column} from stock_movements m
      where m.supplier_id = supplier_items.supplier_id and m.item_id = supplier_items.item_id
        and m.type = 'PURCHASE'
        and not exists (select 1 from stock_movements r where r.reverses_id = m.id)
      order by m.occurred_at desc, m.created_at desc limit 1)`);

  const itemSelect = () =>
    tx
      .select({
        si: supplierItems,
        supplierName: suppliers.name,
        supplierActive: suppliers.active,
        itemCode: items.code,
        itemName: items.description,
        itemActive: items.active,
        stockUnitId: items.stockUnitId,
        lastAt: sql<Date | string | null>`${lastPurchase("occurred_at")}`,
        lastCost: sql<string | null>`${lastPurchase("unit_cost")}`,
      })
      .from(supplierItems)
      .innerJoin(suppliers, eq(suppliers.id, supplierItems.supplierId))
      .innerJoin(items, eq(items.id, supplierItems.itemId));
  type ItemRow = Awaited<ReturnType<ReturnType<typeof itemSelect>["execute"]>>[number];
  const toItem = (r: ItemRow): SupplierItemRecord => ({
    id: r.si.id,
    supplierId: r.si.supplierId,
    supplierName: r.supplierName,
    supplierActive: r.supplierActive,
    itemId: r.si.itemId,
    itemCode: r.itemCode,
    itemName: r.itemName,
    itemActive: r.itemActive,
    stockUnit: UNIT_CODE_BY_ID[r.stockUnitId]!,
    packageLabel: r.si.packageLabel,
    packageQuantity: dec(r.si.packageQuantity),
    price: d(r.si.price),
    preferred: r.si.preferred,
    version: r.si.version,
    priceUpdatedAt: r.si.updatedAt,
    lastPurchase: r.lastAt && r.lastCost ? { at: new Date(r.lastAt), unitCost: d(r.lastCost) } : null,
  });

  return {
    insert: (s, audit) =>
      guarded(tx, async () => {
        await tx.insert(suppliers).values({
          id: s.id,
          restaurantId,
          ...toRow(s),
          createdAt: audit.at,
          createdBy: audit.by,
          updatedAt: audit.at,
          updatedBy: audit.by,
        });
        return ok(undefined);
      }),

    update: (id, s, version, audit) => guarded(tx, () => optimistic(suppliers, id, version, toRow(s), audit)),

    setActive: (id, active, version, audit) =>
      guarded(tx, () => optimistic(suppliers, id, version, { active }, audit)),

    async get(id) {
      const [s] = await tx.select().from(suppliers).where(eq(suppliers.id, id));
      if (!s) return null;
      const out: Supplier = {
        id: s.id,
        name: s.name,
        legalName: s.legalName,
        cnpj: s.cnpj,
        contactName: s.contactName,
        phone: s.phone,
        email: s.email,
        deliveryDays: s.deliveryDays,
        leadTimeDays: s.leadTimeDays,
        minOrderValue: dec(s.minOrderValue),
        paymentTerms: s.paymentTerms,
        notes: s.notes,
        active: s.active,
        version: s.version,
      };
      return out;
    },

    async list(f) {
      const where: SQL[] = [];
      const status = f.status ?? "active";
      if (status !== "all") where.push(eq(suppliers.active, status === "active"));
      const q = f.q?.trim();
      if (q) {
        const byName = ilike(suppliers.nameNormalized, `%${escapeLike(normalizeDescription(q))}%`);
        const cnpj = normalizeCnpj(q);
        where.push(/^[0-9A-Z]{2,14}$/.test(cnpj) ? or(byName, ilike(suppliers.cnpj, `${cnpj}%`))! : byName);
      }
      const rows = await tx
        .select({
          id: suppliers.id,
          name: suppliers.name,
          cnpj: suppliers.cnpj,
          contactName: suppliers.contactName,
          phone: suppliers.phone,
          deliveryDays: suppliers.deliveryDays,
          active: suppliers.active,
          itemCount: sql<number>`(select count(*)::int from supplier_items si where si.supplier_id = ${suppliers.id})`,
        })
        .from(suppliers)
        .where(where.length ? and(...where) : undefined)
        .orderBy(asc(suppliers.nameNormalized));
      return rows;
    },

    async findByCnpj(cnpj, exceptId) {
      const [r] = await tx
        .select({ id: suppliers.id, name: suppliers.name })
        .from(suppliers)
        .where(and(eq(suppliers.cnpj, cnpj), exceptId ? ne(suppliers.id, exceptId) : undefined));
      return r ?? null;
    },

    async findActiveByName(normalized, exceptId) {
      const [r] = await tx
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(
          and(
            eq(suppliers.nameNormalized, normalized),
            eq(suppliers.active, true),
            exceptId ? ne(suppliers.id, exceptId) : undefined,
          ),
        );
      return r ?? null;
    },

    async activeWithPackages() {
      const list = await tx
        .select({ id: suppliers.id, name: suppliers.name })
        .from(suppliers)
        .where(eq(suppliers.active, true))
        .orderBy(asc(suppliers.nameNormalized));
      const packs = await tx
        .select({
          supplierId: supplierItems.supplierId,
          itemId: supplierItems.itemId,
          packageLabel: supplierItems.packageLabel,
          packageQuantity: supplierItems.packageQuantity,
        })
        .from(supplierItems)
        .where(sql`${supplierItems.packageLabel} is not null`);
      return list.map((s) => ({
        ...s,
        packages: packs
          .filter((p) => p.supplierId === s.id)
          .map((p) => ({
            itemId: p.itemId,
            packageLabel: p.packageLabel!,
            packageQuantity: d(p.packageQuantity!),
          })),
      }));
    },

    async items(f) {
      const rows = await itemSelect()
        .where(
          and(
            f.supplierId ? eq(supplierItems.supplierId, f.supplierId) : undefined,
            f.itemId ? eq(supplierItems.itemId, f.itemId) : undefined,
          ),
        )
        .orderBy(f.itemId ? asc(suppliers.nameNormalized) : asc(items.descriptionNormalized));
      return rows.map(toItem);
    },

    async getItem(id) {
      const [r] = await itemSelect().where(eq(supplierItems.id, id));
      return r ? toItem(r) : null;
    },

    async findOffer(supplierId, itemId) {
      const [r] = await itemSelect().where(
        and(eq(supplierItems.supplierId, supplierId), eq(supplierItems.itemId, itemId)),
      );
      return r ? toItem(r) : null;
    },

    insertItem: (row, audit) =>
      guarded(tx, async () => {
        await tx.insert(supplierItems).values({
          id: row.id,
          restaurantId,
          supplierId: row.supplierId,
          itemId: row.itemId,
          packageLabel: row.packageLabel,
          packageQuantity: str(row.packageQuantity),
          price: row.price.toString(),
          preferred: row.preferred,
          createdAt: audit.at,
          createdBy: audit.by,
          updatedAt: audit.at,
          updatedBy: audit.by,
        });
        return ok(undefined);
      }),

    updateItem: (id, data, version, audit) =>
      guarded(tx, () =>
        optimistic(
          supplierItems,
          id,
          version,
          {
            packageLabel: data.packageLabel,
            packageQuantity: str(data.packageQuantity),
            price: data.price.toString(),
            preferred: data.preferred,
          },
          audit,
        ),
      ),

    async deleteItem(id) {
      await tx.delete(supplierItems).where(eq(supplierItems.id, id));
    },

    async clearPreferred(itemId, exceptId, audit) {
      await tx
        .update(supplierItems)
        .set({
          preferred: false,
          version: sql`${supplierItems.version} + 1`,
          updatedAt: audit.at,
          updatedBy: audit.by,
        })
        .where(
          and(
            eq(supplierItems.itemId, itemId),
            eq(supplierItems.preferred, true),
            ne(supplierItems.id, exceptId),
          ),
        );
    },
  };
}

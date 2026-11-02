import type { Result } from "@/domain/shared/result";
import type { Decimal } from "@/domain/shared/decimal";
import type { UnitCode } from "@/domain/inventory/units";
import type { Supplier, SupplierData, SupplierItemData } from "@/domain/suppliers/supplier";
import type { Audit } from "../access/ports";

export type SupplierFilter = { q?: string; status?: "active" | "blocked" | "all" };

export type SupplierListRow = {
  id: string;
  name: string;
  cnpj: string | null;
  contactName: string | null;
  phone: string | null;
  deliveryDays: number[];
  active: boolean;
  itemCount: number;
};

/** Item que o fornecedor vende, com o que a tela precisa. */
export type SupplierItemRecord = {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierActive: boolean;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemActive: boolean;
  stockUnit: UnitCode;
  packageLabel: string | null;
  packageQuantity: Decimal | null;
  price: Decimal;
  preferred: boolean;
  version: number;
  priceUpdatedAt: Date;
  /** Última compra lançada deste fornecedor para este item (spec 007, US4). */
  lastPurchase: { at: Date; unitCost: Decimal } | null;
};

export interface SupplierRepo {
  insert(s: SupplierData & { id: string; nameNormalized: string }, audit: Audit): Promise<Result<void>>;
  update(
    id: string,
    s: SupplierData & { nameNormalized: string },
    version: number,
    audit: Audit,
  ): Promise<Result<void>>;
  setActive(id: string, active: boolean, version: number, audit: Audit): Promise<Result<void>>;
  get(id: string): Promise<Supplier | null>;
  list(filter: SupplierFilter): Promise<SupplierListRow[]>;
  findByCnpj(cnpj: string, exceptId?: string): Promise<{ id: string; name: string } | null>;
  findActiveByName(normalized: string, exceptId?: string): Promise<{ id: string } | null>;
  /** Fornecedores ativos com as embalagens de cada item, para o lançamento de compra. */
  activeWithPackages(): Promise<
    {
      id: string;
      name: string;
      packages: { itemId: string; packageLabel: string; packageQuantity: Decimal }[];
    }[]
  >;
  items(filter: { supplierId?: string; itemId?: string }): Promise<SupplierItemRecord[]>;
  getItem(id: string): Promise<SupplierItemRecord | null>;
  findOffer(supplierId: string, itemId: string): Promise<SupplierItemRecord | null>;
  insertItem(row: SupplierItemData & { id: string; supplierId: string }, audit: Audit): Promise<Result<void>>;
  updateItem(
    id: string,
    data: Omit<SupplierItemData, "itemId">,
    version: number,
    audit: Audit,
  ): Promise<Result<void>>;
  deleteItem(id: string): Promise<void>;
  /** Tira a marca de preferido dos outros fornecedores deste item. */
  clearPreferred(itemId: string, exceptId: string, audit: Audit): Promise<void>;
}

export type SupplierRepos = { suppliers: SupplierRepo };

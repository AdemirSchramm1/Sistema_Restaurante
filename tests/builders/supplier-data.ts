import { d } from "../../src/domain/shared/decimal";
import type { SupplierData, SupplierItemData } from "../../src/domain/suppliers/supplier";

/** Fornecedor só com o nome; o resto em branco. */
export function supplierData(over: Partial<SupplierData> = {}): SupplierData {
  return {
    name: "Hortifruti do João",
    legalName: null,
    cnpj: null,
    contactName: null,
    phone: null,
    email: null,
    deliveryDays: [],
    leadTimeDays: null,
    minOrderValue: null,
    paymentTerms: null,
    notes: null,
    ...over,
  };
}

/** Item do fornecedor: caixa de 18 kg a R$ 90,00. */
export function supplierItemData(itemId: string, over: Partial<SupplierItemData> = {}): SupplierItemData {
  return {
    itemId,
    packageLabel: "Caixa",
    packageQuantity: d(18),
    price: d(90),
    preferred: false,
    ...over,
  };
}

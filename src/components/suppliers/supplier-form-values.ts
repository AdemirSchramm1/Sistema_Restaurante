import { formatBrDecimal } from "@/domain/shared/decimal";
import { formatCnpj } from "@/domain/suppliers/cnpj";
import type { Supplier } from "@/domain/suppliers/supplier";

/** Valores do formulário do fornecedor, sempre como texto (vírgula decimal). */
export type SupplierFormValues = Record<string, string | string[]>;

export const emptySupplierValues: SupplierFormValues = {
  name: "",
  legalName: "",
  cnpj: "",
  contactName: "",
  phone: "",
  email: "",
  deliveryDays: [],
  leadTimeDays: "",
  minOrderValue: "",
  paymentTerms: "",
  notes: "",
};

export function supplierToValues(s: Supplier): SupplierFormValues {
  return {
    name: s.name,
    legalName: s.legalName ?? "",
    cnpj: s.cnpj ? formatCnpj(s.cnpj) : "",
    contactName: s.contactName ?? "",
    phone: s.phone ?? "",
    email: s.email ?? "",
    deliveryDays: s.deliveryDays.map(String),
    leadTimeDays: s.leadTimeDays === null ? "" : String(s.leadTimeDays),
    minOrderValue: s.minOrderValue ? formatBrDecimal(s.minOrderValue, { minPlaces: 2, maxPlaces: 2 }) : "",
    paymentTerms: s.paymentTerms ?? "",
    notes: s.notes ?? "",
  };
}

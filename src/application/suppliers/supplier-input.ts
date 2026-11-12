import type { SupplierData, SupplierItemData } from "@/domain/suppliers/supplier";
import { parseBrDecimal } from "@/domain/shared/decimal";
import { err, ok, type Result } from "@/domain/shared/result";
import { formText, isId, optionalDecimal, optionalText } from "../form-input";

const SUPPLIER_FIELDS = [
  "name",
  "legalName",
  "cnpj",
  "contactName",
  "phone",
  "email",
  "deliveryDays",
  "leadTimeDays",
  "minOrderValue",
  "paymentTerms",
  "notes",
] as const;

/** Formulário do fornecedor (texto, vírgula decimal) → SupplierData. A validação de regra fica no domínio. */
export function parseSupplierForm(raw: Record<string, unknown>): Result<SupplierData> {
  const unknown = Object.keys(raw).filter((k) => !(SUPPLIER_FIELDS as readonly string[]).includes(k));
  if (unknown.length) return err("VALIDATION", undefined, { keys: unknown });

  const daysRaw = raw.deliveryDays;
  const days = (
    Array.isArray(daysRaw) ? daysRaw : daysRaw === undefined || daysRaw === "" ? [] : [daysRaw]
  ).map(formText);
  if (days.some((day) => !/^[0-6]$/.test(day))) return err("VALIDATION", "deliveryDays");

  const lead = formText(raw.leadTimeDays);
  if (lead && !/^\d{1,3}$/.test(lead)) return err("VALIDATION", "leadTimeDays");
  const minOrder = optionalDecimal(raw.minOrderValue, "minOrderValue", "INVALID_AMOUNT");
  if (!minOrder.ok) return minOrder;

  return ok({
    name: formText(raw.name),
    legalName: optionalText(raw.legalName),
    cnpj: optionalText(raw.cnpj),
    contactName: optionalText(raw.contactName),
    phone: optionalText(raw.phone),
    email: optionalText(raw.email),
    deliveryDays: days.map(Number),
    leadTimeDays: lead ? Number.parseInt(lead, 10) : null,
    minOrderValue: minOrder.value,
    paymentTerms: optionalText(raw.paymentTerms),
    notes: optionalText(raw.notes),
  });
}

/** Formulário do item do fornecedor. Na edição o item não muda e não vem (`requireItem: false`). */
export function parseSupplierItemForm(
  raw: Record<string, unknown>,
  { requireItem = true } = {},
): Result<SupplierItemData> {
  const itemId = formText(raw.itemId);
  if (requireItem && !isId(itemId)) return err("VALIDATION", "itemId");
  const priceText = formText(raw.price);
  if (!priceText) return err("INVALID_PRICE", "price");
  const price = parseBrDecimal(priceText);
  if (!price.ok) return err("INVALID_PRICE", "price");
  const qty = optionalDecimal(raw.packageQuantity, "packageQuantity", "INVALID_FACTOR");
  if (!qty.ok) return qty;
  return ok({
    itemId,
    packageLabel: optionalText(raw.packageLabel),
    packageQuantity: qty.value,
    price: price.value,
    preferred: raw.preferred === "on" || raw.preferred === "true",
  });
}

import type { Decimal } from "../shared/decimal";
import { err, ok, type Result } from "../shared/result";
import { parseCnpj } from "./cnpj";

/** Cadastro comercial do fornecedor (docs/produto/estoque/03-fornecedores.md, spec 007). */
export type SupplierData = {
  name: string;
  legalName: string | null;
  /** Normalizado (14 caracteres) ou como digitado; `validateSupplier` normaliza. */
  cnpj: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  /** 0 = domingo … 6 = sábado. */
  deliveryDays: number[];
  /** Em quantos dias entrega depois do pedido. */
  leadTimeDays: number | null;
  minOrderValue: Decimal | null;
  paymentTerms: string | null;
  notes: string | null;
};

export type Supplier = SupplierData & { id: string; active: boolean; version: number };

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
export const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;

export const NAME_MIN = 3;
export const NAME_MAX = 120;
export const LEAD_TIME_MAX = 90;
const SHORT_MAX = 120;
const TERMS_MAX = 200;
const NOTES_MAX = 1000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (s: string | null) => (s && s.trim() ? s.trim() : null);

/** Valida e devolve os dados limpos (textos aparados, CNPJ sem pontuação, dias em ordem). */
export function validateSupplier(data: SupplierData): Result<SupplierData> {
  const name = data.name.trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) return err("INVALID_NAME", "name");

  const texts = {
    legalName: [clean(data.legalName), SHORT_MAX],
    contactName: [clean(data.contactName), SHORT_MAX],
    phone: [clean(data.phone), 40],
    email: [clean(data.email)?.toLowerCase() ?? null, SHORT_MAX],
    paymentTerms: [clean(data.paymentTerms), TERMS_MAX],
    notes: [clean(data.notes), NOTES_MAX],
  } as const;
  for (const [field, [value, max]] of Object.entries(texts))
    if (value && value.length > max) return err("VALIDATION", field);

  const cnpj = parseCnpj(data.cnpj ?? "");
  if (!cnpj.ok) return cnpj;
  if (texts.email[0] && !EMAIL.test(texts.email[0])) return err("INVALID_EMAIL", "email");

  if (data.deliveryDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6))
    return err("VALIDATION", "deliveryDays");
  const lead = data.leadTimeDays;
  if (lead !== null && (!Number.isInteger(lead) || lead < 0 || lead > LEAD_TIME_MAX))
    return err("VALIDATION", "leadTimeDays");
  const min = data.minOrderValue;
  if (min && (min.lt(0) || min.decimalPlaces() > 2)) return err("INVALID_AMOUNT", "minOrderValue");

  return ok({
    name,
    legalName: texts.legalName[0],
    cnpj: cnpj.value,
    contactName: texts.contactName[0],
    phone: texts.phone[0],
    email: texts.email[0],
    deliveryDays: [...new Set(data.deliveryDays)].sort((a, b) => a - b),
    leadTimeDays: lead,
    minOrderValue: min,
    paymentTerms: texts.paymentTerms[0],
    notes: texts.notes[0],
  });
}

/** O que o fornecedor vende: preço por embalagem dele, ou por medida do item sem embalagem. */
export type SupplierItemData = {
  itemId: string;
  packageLabel: string | null;
  /** Quanto vem na embalagem, na medida do item. */
  packageQuantity: Decimal | null;
  price: Decimal;
  preferred: boolean;
};

export const PACKAGE_LABEL_MAX = 60;

export function validateSupplierItem(data: SupplierItemData): Result<SupplierItemData> {
  if (data.price.lte(0) || data.price.decimalPlaces() > 4) return err("INVALID_PRICE", "price");
  const label = clean(data.packageLabel);
  const qty = data.packageQuantity;
  if (label && !qty) return err("PURCHASE_FACTOR_REQUIRED", "packageQuantity");
  if (qty && !label) return err("PURCHASE_LABEL_REQUIRED", "packageLabel");
  if (label && label.length > PACKAGE_LABEL_MAX) return err("VALIDATION", "packageLabel");
  if (qty && (qty.lte(0) || qty.decimalPlaces() > 4)) return err("INVALID_FACTOR", "packageQuantity");
  return ok({ ...data, packageLabel: label, packageQuantity: qty });
}

/** Preço por medida do item, exato (FR-005). */
export const pricePerUnit = (o: { price: Decimal; packageQuantity: Decimal | null }) =>
  o.packageQuantity ? o.price.dividedBy(o.packageQuantity) : o.price;

/** Id da oferta mais barata por medida; null com menos de duas ofertas. Empate fica com a primeira. */
export function cheapestOffer(
  offers: readonly { id: string; price: Decimal; packageQuantity: Decimal | null }[],
): string | null {
  if (offers.length < 2) return null;
  let best = offers[0]!;
  for (const o of offers.slice(1)) if (pricePerUnit(o).lt(pricePerUnit(best))) best = o;
  return best.id;
}

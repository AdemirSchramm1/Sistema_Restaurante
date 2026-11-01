import { ALLERGEN_LABELS, isAllergen } from "@/domain/inventory/allergens";
import {
  COUNT_FREQUENCY_LABELS,
  ITEM_TYPE_LABELS,
  type CountFrequency,
  type ItemType,
} from "@/domain/inventory/item";
import { LOCATION_KIND_LABELS, type LocationKind } from "@/domain/inventory/location";
import { STORAGE_CLASS_LABELS, type StorageClass } from "@/domain/inventory/default-tree";
import { ROLE_LABELS, type Role } from "@/domain/access/permissions";

/** Nome em português de cada campo que aparece no histórico. */
export const FIELD_LABELS: Record<string, string> = {
  code: "Código",
  name: "Nome",
  description: "Descrição",
  type: "Tipo",
  subgroupId: "Subgrupo",
  stockUnit: "Unidade de estoque",
  recipeUnit: "Unidade de receita",
  purchaseUnitLabel: "Unidade de compra",
  purchaseFactor: "Fator de compra",
  conversions: "Conversão do item",
  eanUnit: "EAN da unidade",
  eanPackage: "EAN da embalagem",
  noGtin: "Sem GTIN",
  financialCategory: "Categoria financeira",
  presentation: "Apresentação",
  netWeight: "Peso líquido",
  drainedWeight: "Peso drenado",
  catchWeight: "Peso variável",
  correctionFactor: "Fator de correção",
  yieldFactor: "Rendimento",
  storageTempMaxC: "Temperatura máx. de conservação",
  receivingTempMinC: "Recebimento: temperatura mín.",
  receivingTempMaxC: "Recebimento: temperatura máx.",
  shelfLifeDays: "Validade fechado (dias)",
  openedLifeDays: "Validade após aberto (dias)",
  lotControl: "Controla lote",
  expiryAlertDays: "Alerta de vencimento (dias)",
  allergens: "Alérgenos",
  ncm: "NCM",
  cest: "CEST",
  origin: "Origem",
  taxGroup: "Grupo tributário",
  countable: "Inventariável",
  countFrequency: "Frequência de contagem",
  inCogsOverride: "Entra no CMV",
  inCogs: "Entra no CMV",
  storageClass: "Classe de armazenagem",
  locations: "Locais",
  active: "Ativo",
  kind: "Tipo de local",
  tempMinC: "Temperatura mín.",
  tempMaxC: "Temperatura máx.",
  responsibleUserId: "Responsável",
  countOrder: "Ordem na contagem",
  roles: "Papéis",
  email: "E-mail",
  status: "Situação",
  userId: "Usuário",
  invitationId: "Convite",
};

/** Campos cujo valor é um id interno ou uma lista técnica: o histórico só diz que mudou. */
const OPAQUE = new Set(["subgroupId", "responsibleUserId", "userId", "invitationId", "locations"]);

const DECIMAL = /^-?\d+\.\d+$/;

function one(field: string, v: unknown): string {
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "number") return String(v);
  if (typeof v !== "string") return String(v);
  if (field === "type" && v in ITEM_TYPE_LABELS) return ITEM_TYPE_LABELS[v as ItemType];
  if (field === "countFrequency" && v in COUNT_FREQUENCY_LABELS)
    return COUNT_FREQUENCY_LABELS[v as CountFrequency];
  if (field === "kind" && v in LOCATION_KIND_LABELS) return LOCATION_KIND_LABELS[v as LocationKind];
  if (field === "storageClass" && v in STORAGE_CLASS_LABELS) return STORAGE_CLASS_LABELS[v as StorageClass];
  if (field === "allergens" && isAllergen(v)) return ALLERGEN_LABELS[v];
  if (field === "roles" && v in ROLE_LABELS) return ROLE_LABELS[v as Role];
  if (DECIMAL.test(v)) return v.replace(".", ",");
  return v;
}

/** Valor legível de um campo no histórico. */
export function showValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return field === "inCogsOverride" ? "segue o grupo" : "—";
  if (Array.isArray(v)) return v.length ? v.map((x) => one(field, x)).join(", ") : "—";
  return one(field, v);
}

/** Uma linha do histórico: "Campo: antes → depois", ou "Campo: alterado" para ids. */
export function describeChange(field: string, before: unknown, after: unknown): string {
  const label = FIELD_LABELS[field] ?? field;
  if (OPAQUE.has(field)) return `${label}: alterado`;
  return `${label}: ${showValue(field, before)} → ${showValue(field, after)}`;
}

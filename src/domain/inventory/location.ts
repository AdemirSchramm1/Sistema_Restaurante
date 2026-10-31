import type { Decimal } from "../shared/decimal";

export const LOCATION_KINDS = [
  "DRY",
  "CHILLED",
  "FROZEN",
  "QUARANTINE",
  "IN_TRANSIT",
  "CHEMICALS",
  "STATION",
  "BAR",
  "NON_FOOD",
] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

export const LOCATION_KIND_LABELS: Record<LocationKind, string> = {
  DRY: "Seco",
  CHILLED: "Refrigerado",
  FROZEN: "Congelado",
  QUARANTINE: "Quarentena",
  IN_TRANSIT: "Em trânsito",
  CHEMICALS: "Químicos",
  STATION: "Praça",
  BAR: "Bar",
  NON_FOOD: "Não alimentar",
};

export type LocationData = {
  name: string;
  kind: LocationKind;
  tempMinC: Decimal | null;
  tempMaxC: Decimal | null;
  responsibleUserId: string | null;
  countOrder: number;
};

export type Location = LocationData & { id: string; isSystem: boolean; active: boolean; version: number };

export const QUARANTINE_LOCATION_NAME = "Recebimento / quarentena";

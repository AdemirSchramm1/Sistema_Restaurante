import type { Decimal } from "../shared/decimal";
import { err, ok, type Result } from "../shared/result";
import type { StorageClass } from "./default-tree";

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

// ---------------------------------------------------------------------------
// Regras (docs/produto/estoque/05-locais.md)

const NEEDS_RANGE: readonly LocationKind[] = ["CHILLED", "FROZEN"];

export function validateLocation(l: LocationData): Result<void> {
  const name = l.name.trim();
  if (name.length < 2 || name.length > 80) return err("VALIDATION", "name");
  if (!LOCATION_KINDS.includes(l.kind)) return err("VALIDATION", "kind");
  if (!Number.isInteger(l.countOrder) || l.countOrder < 0) return err("VALIDATION", "countOrder");
  if (NEEDS_RANGE.includes(l.kind) && (!l.tempMinC || !l.tempMaxC))
    return err("TEMPERATURE_RANGE_REQUIRED", "tempMinC");
  if (l.tempMinC && l.tempMaxC && l.tempMinC.gt(l.tempMaxC))
    return err("TEMPERATURE_RANGE_INVALID", "tempMinC");
  return ok(undefined);
}

const CHEMICAL_ALLOWED: readonly LocationKind[] = ["CHEMICALS", "QUARANTINE", "IN_TRANSIT"];

/** Saneantes só em local de químicos (ou quarentena/trânsito); nada além deles no local de químicos (FR-029). */
export function checkItemLocation(storageClass: StorageClass, kind: LocationKind): Result<void> {
  if (storageClass === "CHEMICAL")
    return CHEMICAL_ALLOWED.includes(kind) ? ok(undefined) : err("LOCATION_INCOMPATIBLE");
  return kind === "CHEMICALS" ? err("LOCATION_INCOMPATIBLE") : ok(undefined);
}

/** Folha de contagem: ordem da prateleira, depois código (FR-016). */
export function orderCountSheet<T extends { sheetPosition: number; code: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => a.sheetPosition - b.sheetPosition || a.code.localeCompare(b.code));
}

/** Locais na rota de contagem; empate pelo nome. */
export function orderLocations<T extends { countOrder: number; name: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => a.countOrder - b.countOrder || a.name.localeCompare(b.name, "pt-BR"));
}

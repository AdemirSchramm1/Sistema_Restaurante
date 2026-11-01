import { err, ok, type Result } from "../shared/result";

/** Tipos guardados no banco. QUARANTINE e IN_TRANSIT ficam só por compatibilidade com dados antigos. */
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

/** Tipos oferecidos na tela (docs/produto/estoque/05-locais.md). */
export const LOCATION_KIND_OPTIONS: readonly LocationKind[] = [
  "DRY",
  "CHILLED",
  "FROZEN",
  "BAR",
  "STATION",
  "CHEMICALS",
  "NON_FOOD",
];

export const LOCATION_KIND_LABELS: Record<LocationKind, string> = {
  DRY: "Despensa (seco)",
  CHILLED: "Geladeira",
  FROZEN: "Freezer",
  QUARANTINE: "Quarentena",
  IN_TRANSIT: "Em trânsito",
  CHEMICALS: "Limpeza",
  STATION: "Praça",
  BAR: "Bar",
  NON_FOOD: "Descartáveis e outros",
};

export type LocationData = { name: string; kind: LocationKind };

export type Location = LocationData & { id: string; isSystem: boolean; active: boolean; version: number };

// ---------------------------------------------------------------------------
// Regras (docs/produto/estoque/05-locais.md)

export function validateLocation(l: LocationData): Result<void> {
  const name = l.name.trim();
  if (name.length < 2 || name.length > 80) return err("VALIDATION", "name");
  if (!LOCATION_KINDS.includes(l.kind)) return err("VALIDATION", "kind");
  return ok(undefined);
}

/** Locais em ordem alfabética. */
export function orderLocations<T extends { name: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

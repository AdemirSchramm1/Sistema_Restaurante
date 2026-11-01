import { STORAGE_CLASS_LABELS, type StorageClass } from "@/domain/inventory/default-tree";

/** Rótulos dos campos do grupo, sem termos técnicos (specs/002-simplificar-cadastro FR-005). */
export const GROUP_FIELD_LABELS = {
  storageClass: "Que tipo de coisa é",
  inCogs: "Conta no custo dos pratos (CMV)",
} as const;

/** Linha curta mostrada ao lado do nome do grupo. */
export function groupSummary(g: { storageClass: StorageClass; inCogs: boolean }): string {
  const cogs = g.inCogs ? "conta no custo dos pratos" : "não conta no custo dos pratos";
  return `${STORAGE_CLASS_LABELS[g.storageClass]} · ${cogs}`;
}

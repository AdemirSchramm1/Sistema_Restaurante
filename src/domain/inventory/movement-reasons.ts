/** Motivos em lista fechada (docs/produto/estoque/06-movimentacoes.md). Iguais ao seed das migrações 0005 e 0011. */
export type ReasonMovementType = "LOSS" | "ADJUSTMENT" | "REVERSAL";
export type ReasonFamily = "PREP" | "SPOILAGE" | "OPERATIONAL" | "ADJUSTMENT" | "REVERSAL";
export type MovementReason = {
  id: string;
  movementType: ReasonMovementType;
  code: string;
  label: string;
  family: ReasonFamily;
  /** Só o sistema usa (cancelamento de pedido, spec 011): fora das listas e recusado à mão. */
  system?: true;
};

export const REASON_FAMILY_LABELS: Record<ReasonFamily, string> = {
  PREP: "Perda de preparo",
  SPOILAGE: "Estragou",
  OPERATIONAL: "Erro na operação",
  ADJUSTMENT: "Acerto",
  REVERSAL: "Estorno",
};

const r = (
  n: number,
  movementType: ReasonMovementType,
  family: ReasonFamily,
  code: string,
  label: string,
  system = false,
): MovementReason => ({
  id: `0193a100-0000-7000-8000-${String(n).padStart(12, "0")}`,
  movementType,
  family,
  code,
  label,
  ...(system ? { system: true as const } : {}),
});

export const MOVEMENT_REASONS: readonly MovementReason[] = [
  r(1, "LOSS", "PREP", "PREP_TRIM", "Limpeza ou apara acima do normal"),
  r(2, "LOSS", "PREP", "PREP_ERROR", "Erro no preparo"),
  r(3, "LOSS", "PREP", "BURNT", "Queimou"),
  r(4, "LOSS", "PREP", "RETURNED", "Cliente devolveu"),
  r(5, "LOSS", "SPOILAGE", "EXPIRED", "Venceu"),
  r(6, "LOSS", "SPOILAGE", "SPOILED", "Estragou"),
  r(7, "LOSS", "SPOILAGE", "PEST", "Praga"),
  r(8, "LOSS", "OPERATIONAL", "DROPPED", "Caiu ou quebrou"),
  r(9, "LOSS", "OPERATIONAL", "WRONG_ORDER", "Pedido feito errado"),
  r(10, "LOSS", "OPERATIONAL", "OVER_PORTION", "Porção maior que a do produto"),
  r(11, "LOSS", "OPERATIONAL", "OTHER", "Outro"),
  r(12, "LOSS", "OPERATIONAL", "ORDER_CANCELLED", "Pedido cancelado", true),
  r(21, "ADJUSTMENT", "ADJUSTMENT", "SHELF_CHECK", "Conferi na prateleira"),
  r(22, "ADJUSTMENT", "ADJUSTMENT", "MISSED_ENTRY", "Lançamento esquecido"),
  r(23, "ADJUSTMENT", "ADJUSTMENT", "MISSING", "Sumiu (possível furto)"),
  r(24, "ADJUSTMENT", "ADJUSTMENT", "OTHER", "Outro"),
  r(31, "REVERSAL", "REVERSAL", "WRONG_ENTRY", "Lançado errado"),
  r(32, "REVERSAL", "REVERSAL", "DUPLICATE", "Lançado em dobro"),
  r(33, "REVERSAL", "REVERSAL", "OTHER", "Outro"),
  r(34, "REVERSAL", "REVERSAL", "ORDER_CANCELLED", "Pedido cancelado", true),
];

/** Motivos que a pessoa escolhe nos formulários. */
export const manualReasons = (type: ReasonMovementType): MovementReason[] =>
  MOVEMENT_REASONS.filter((x) => x.movementType === type && !x.system);

export const reasonById = (id: string) => MOVEMENT_REASONS.find((x) => x.id === id);
export const reasonByCode = (type: ReasonMovementType, code: string) =>
  MOVEMENT_REASONS.find((x) => x.movementType === type && x.code === code);

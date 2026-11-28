/**
 * Tipos de operação do relatório de auditoria (spec 019, FR-003): cada entidade gravada na trilha
 * (`audit_log.entity`) cai em um tipo só, com o nome que a pessoa vê.
 */
export const OPERATION_TYPES = [
  "ITEMS",
  "PRODUCTS",
  "SUPPLIERS",
  "STOCK",
  "TABLES",
  "ORDERS",
  "TABS",
  "CASH",
  "MENU",
  "TEAM",
  "SETTINGS",
] as const;
export type OperationType = (typeof OPERATION_TYPES)[number];

export const OPERATION_TYPE_LABELS: Record<OperationType, string> = {
  ITEMS: "Itens e grupos",
  PRODUCTS: "Produtos e adicionais",
  SUPPLIERS: "Fornecedores",
  STOCK: "Lançamentos de estoque",
  TABLES: "Mesas e QR code",
  ORDERS: "Pedidos",
  TABS: "Contas da mesa",
  CASH: "Caixa do dia",
  MENU: "Cardápio",
  TEAM: "Equipe e acessos",
  SETTINGS: "Configurações do restaurante",
};

const ENTITIES: Record<OperationType, readonly string[]> = {
  ITEMS: ["item", "item_group", "item_subgroup"],
  PRODUCTS: ["recipe", "addon"],
  SUPPLIERS: ["supplier"],
  STOCK: ["stock_movement", "adjustment_request", "stock_report"],
  TABLES: ["dining_table"],
  ORDERS: ["order"],
  TABS: ["table_tab"],
  CASH: ["cash_session"],
  MENU: ["menu", "menu_section"],
  TEAM: ["membership", "invitation"],
  SETTINGS: ["restaurant"],
};

export const entitiesOf = (type: OperationType): readonly string[] => ENTITIES[type];

export function operationTypeOf(entity: string): OperationType | null {
  return OPERATION_TYPES.find((t) => ENTITIES[t].includes(entity)) ?? null;
}

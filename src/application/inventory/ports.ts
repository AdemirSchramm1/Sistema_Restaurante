import type { Result } from "@/domain/shared/result";
import type { DefaultGroup, StorageClass } from "@/domain/inventory/default-tree";
import type { Item, ItemData, ItemType } from "@/domain/inventory/item";
import type { Decimal } from "@/domain/shared/decimal";
import type { UnitCode } from "@/domain/inventory/units";
import type { ComponentInfo, ComponentRef, RecipeKind, RecipeLineData } from "@/domain/inventory/recipe";
import type { RecipeNode } from "@/domain/inventory/recipe-graph";
import type { AdjustmentStatus, MovementType, StockItem } from "@/domain/inventory/movement";
import type { Audit } from "../access/ports";

export type GroupRecord = {
  id: string;
  code: string;
  name: string;
  storageClass: StorageClass;
  inCogs: boolean;
  isSystem: boolean;
  active: boolean;
  version: number;
};
export type SubgroupRecord = {
  id: string;
  groupId: string;
  code: string;
  name: string;
  active: boolean;
  version: number;
  activeItems: number;
};
export type GroupTree = (GroupRecord & { subgroups: SubgroupRecord[] })[];

export interface GroupRepo {
  seedDefaultTree(tree: readonly DefaultGroup[], ids: () => string, audit: Audit): Promise<void>;
  tree(includeInactive: boolean): Promise<GroupTree>;
  getGroup(id: string): Promise<GroupRecord | null>;
  getSubgroup(id: string): Promise<(SubgroupRecord & { group: GroupRecord }) | null>;
  /** Reserva o próximo número (com lock de linha) e devolve o valor reservado. */
  takeNextGroupCode(): Promise<number>;
  takeNextSubgroupCode(groupId: string): Promise<number>;
  insertGroup(g: Omit<GroupRecord, "version" | "isSystem" | "active">, audit: Audit): Promise<Result<void>>;
  insertSubgroup(
    s: { id: string; groupId: string; code: string; name: string },
    audit: Audit,
  ): Promise<Result<void>>;
  renameGroup(id: string, name: string, version: number, audit: Audit): Promise<Result<void>>;
  renameSubgroup(id: string, name: string, version: number, audit: Audit): Promise<Result<void>>;
  setGroupActive(id: string, active: boolean, version: number, audit: Audit): Promise<Result<void>>;
  setSubgroupActive(id: string, active: boolean, version: number, audit: Audit): Promise<Result<void>>;
}

export type ItemFilter = {
  q?: string;
  groupId?: string;
  subgroupId?: string;
  type?: ItemType;
  status?: "active" | "inactive" | "all";
  page: number;
  pageSize: number;
};
export type ItemListRow = Pick<
  Item,
  "id" | "code" | "description" | "type" | "active" | "stockUnit" | "purchaseUnitLabel" | "purchaseFactor"
> & {
  groupName: string;
  subgroupName: string;
  /** Saldo na medida do item (soma do livro). */
  balance: Decimal;
  /** Chegou no ponto de reposição (spec 006). */
  atReorderPoint: boolean;
};

export interface ItemRepo {
  /** Reserva o próximo sequencial do subgrupo (com lock de linha). */
  takeNextItemSeq(subgroupId: string): Promise<number>;
  insert(
    item: ItemData & { id: string; code: string; descriptionNormalized: string },
    audit: Audit,
  ): Promise<Result<void>>;
  update(
    id: string,
    data: ItemData & { descriptionNormalized: string },
    version: number,
    audit: Audit,
  ): Promise<Result<void>>;
  get(id: string): Promise<Item | null>;
  list(filter: ItemFilter): Promise<{ rows: ItemListRow[]; total: number }>;
  findActiveByDescription(
    subgroupId: string,
    normalized: string,
    exceptId?: string,
  ): Promise<{ id: string; code: string } | null>;
  setActive(id: string, active: boolean, version: number, audit: Audit): Promise<Result<void>>;
  setCogsOverride(id: string, value: boolean | null, version: number, audit: Audit): Promise<Result<void>>;
  setReorderLevels(
    id: string,
    levels: { reorderPoint: Decimal | null; parLevel: Decimal | null },
    version: number,
    audit: Audit,
  ): Promise<Result<void>>;
  activeCountInSubgroup(subgroupId: string): Promise<number>;
  /** Saldo do item na sua medida (0 sem movimentação). */
  balance(id: string): Promise<Decimal>;
}

export type RecipeVersionRecord = {
  id: string;
  number: number;
  validFrom: Date;
  yieldQuantity: Decimal | null;
  yieldUnit: UnitCode | null;
  lines: RecipeLineData[];
};
export type RecipeRecord = {
  id: string;
  name: string;
  kind: RecipeKind;
  active: boolean;
  version: number;
  /** Preço de venda (só produto vendido; spec 008). */
  salePrice: Decimal | null;
  current: RecipeVersionRecord;
};
export type RecipeListRow = {
  id: string;
  name: string;
  kind: RecipeKind;
  active: boolean;
  lineCount: number;
  versionNumber: number;
};
export type RecipeFilter = { q?: string; kind?: RecipeKind; status?: "active" | "inactive" | "all" };
/** Item ou preparo com o que a tela e o custo precisam. */
export type ComponentRecord = ComponentInfo & { averageCost: Decimal | null };

export interface RecipeRepo {
  insert(
    r: { id: string; name: string; nameNormalized: string; kind: RecipeKind },
    audit: Audit,
  ): Promise<Result<void>>;
  update(
    id: string,
    r: { name: string; nameNormalized: string; kind: RecipeKind },
    version: number,
    audit: Audit,
  ): Promise<Result<void>>;
  setActive(id: string, active: boolean, version: number, audit: Audit): Promise<Result<void>>;
  setSalePrice(id: string, salePrice: Decimal | null, version: number, audit: Audit): Promise<Result<void>>;
  insertVersion(
    v: Omit<RecipeVersionRecord, "id"> & { id: string; recipeId: string },
    lineIds: () => string,
    audit: Audit,
  ): Promise<void>;
  /** Produto com a versão mais nova. */
  get(id: string): Promise<RecipeRecord | null>;
  versionAt(recipeId: string, at: Date): Promise<RecipeVersionRecord | null>;
  list(filter: RecipeFilter): Promise<RecipeListRow[]>;
  findActiveByName(normalized: string, exceptId?: string): Promise<{ id: string } | null>;
  /** Versão mais nova de cada preparo do restaurante (ativos e inativos). */
  subRecipeGraph(): Promise<Map<string, RecipeNode>>;
  /** Produtos ativos (vendidos e preparos) com a versão mais nova, em ordem de nome. */
  activeWithLatest(): Promise<RecipeRecord[]>;
  /** Nomes dos produtos ativos cuja versão mais nova usa este preparo. */
  usedBy(recipeId: string): Promise<string[]>;
  /** Itens e preparos pelos ids (só os do restaurante, pelo RLS). */
  components(refs: readonly ComponentRef[]): Promise<ComponentRecord[]>;
  /** Itens e preparos ativos para escolher no formulário. */
  activeComponents(): Promise<ComponentRecord[]>;
}

export type MovementRecord = {
  id: string;
  type: MovementType;
  itemId: string;
  itemName: string;
  stockUnit: UnitCode;
  quantity: Decimal;
  enteredQuantity: Decimal;
  enteredUnit: string;
  unitCost: Decimal;
  totalCost: Decimal;
  reasonId: string | null;
  notes: string | null;
  occurredAt: Date;
  recordedAt: Date;
  recordedBy: string | null;
  recordedByName: string | null;
  approvedBy: string | null;
  approvedByName: string | null;
  reversesId: string | null;
  reversedById: string | null;
  supplierId: string | null;
  supplierName: string | null;
  /** Pedido da venda, ou do estorno e da perda do cancelamento (spec 011). */
  order: { id: string; number: number; tableName: string } | null;
};
export type NewMovement = {
  id: string;
  type: MovementType;
  itemId: string;
  quantity: Decimal;
  enteredQuantity: Decimal;
  enteredUnit: string;
  unitCost: Decimal;
  totalCost: Decimal;
  reasonId: string | null;
  notes: string | null;
  occurredAt: Date;
  recordedBy: string | null;
  recordedAt: Date;
  reversesId: string | null;
  approvedBy: string | null;
  idempotencyKey: string | null;
  /** Só na compra (spec 007). */
  supplierId?: string | null;
  /** Venda e cancelamento do pedido (spec 011). */
  orderId?: string | null;
};

/** Venda gravada de um pedido, para o cancelamento (spec 011). */
export type SaleMovement = {
  id: string;
  itemId: string;
  quantity: Decimal;
  unitCost: Decimal;
  totalCost: Decimal;
  reversed: boolean;
};
export type MovementFilter = { itemId?: string; type?: MovementType; limit?: number };

export type AdjustmentRequestRecord = {
  id: string;
  itemId: string;
  itemName: string;
  stockUnit: UnitCode;
  countedQuantity: Decimal;
  systemQuantity: Decimal;
  difference: Decimal;
  reasonId: string;
  notes: string | null;
  status: AdjustmentStatus;
  requestedBy: string;
  requestedByName: string | null;
  requestedAt: Date;
  decidedBy: string | null;
  decidedByName: string | null;
  decidedAt: Date | null;
  decisionNotes: string | null;
  movementId: string | null;
};

export interface MovementRepo {
  /** Item com saldo, travado até o fim da transação (SELECT … FOR UPDATE). */
  lockItem(itemId: string): Promise<StockItem | null>;
  insert(m: NewMovement): Promise<void>;
  /** Soma `delta` ao saldo do item (a linha já está travada por `lockItem`). */
  addToBalance(itemId: string, delta: Decimal, at: Date): Promise<void>;
  setCosts(itemId: string, costs: { averageCost: Decimal; lastCost?: Decimal; at: Date }): Promise<void>;
  /** Trava a medida do item na primeira movimentação. */
  lockStockUnit(itemId: string, at: Date): Promise<void>;
  findByIdempotencyKey(key: string): Promise<string | null>;
  /** Vendas do pedido, por item (spec 011). */
  salesForOrder(orderId: string): Promise<SaleMovement[]>;
  get(id: string): Promise<MovementRecord | null>;
  list(filter: MovementFilter): Promise<MovementRecord[]>;
  insertRequest(r: {
    id: string;
    itemId: string;
    countedQuantity: Decimal;
    systemQuantity: Decimal;
    difference: Decimal;
    reasonId: string;
    notes: string | null;
    by: string;
    at: Date;
  }): Promise<void>;
  /** Pedido travado até o fim da transação. */
  lockRequest(id: string): Promise<AdjustmentRequestRecord | null>;
  closeRequest(
    id: string,
    d: {
      status: Exclude<AdjustmentStatus, "PENDING">;
      by: string;
      at: Date;
      notes: string | null;
      movementId: string | null;
    },
  ): Promise<void>;
  listRequests(status: AdjustmentStatus | "ALL"): Promise<AdjustmentRequestRecord[]>;
}

/** Linha da lista "Repor" e do quadro do item (spec 006). */
export type ReorderRow = {
  itemId: string;
  code: string;
  name: string;
  unit: UnitCode;
  active: boolean;
  balance: Decimal;
  reorderPoint: Decimal | null;
  parLevel: Decimal | null;
  purchaseUnitLabel: string | null;
  purchaseFactor: Decimal | null;
  /** Fornecedor preferido do item, se houver. */
  supplier: {
    name: string;
    phone: string | null;
    leadTimeDays: number | null;
    deliveryDays: number[];
    packageLabel: string | null;
    packageQuantity: Decimal | null;
  } | null;
};

/** Saídas no período por item (positivas), com o saldo atual. */
export type OutflowByItem = {
  itemId: string;
  name: string;
  unit: UnitCode;
  quantity: Decimal;
  value: Decimal;
  balance: Decimal;
};

/** Consultas só de leitura para o aviso e os gráficos (spec 006). */
export interface ReportRepo {
  /** Itens com aviso; `atPointOnly` filtra os que chegaram no ponto; `itemId` busca um só (com ou sem aviso). */
  reorderRows(filter: { atPointOnly?: boolean; itemId?: string }): Promise<ReorderRow[]>;
  countAtReorderPoint(): Promise<number>;
  /** Itens ativos com saída no período ou saldo, com o total que saiu. */
  outflowByItem(from: Date, to: Date, itemIds?: readonly string[]): Promise<OutflowByItem[]>;
  outflowByReason(from: Date, to: Date): Promise<{ reasonId: string; value: Decimal }[]>;
  totals(from: Date, to: Date): Promise<{ inflow: Decimal; outflow: Decimal; losses: Decimal }>;
  /** Entradas e saídas por semana (segunda a domingo, no fuso dado); semanas sem movimento vêm zeradas. */
  weekly(
    from: Date,
    to: Date,
    timezone: string,
  ): Promise<{ weekStart: string; inflow: Decimal; outflow: Decimal }[]>;
}

export type CatalogRepos = {
  groups: GroupRepo;
  items: ItemRepo;
  recipes: RecipeRepo;
  movements: MovementRepo;
  reports: ReportRepo;
};

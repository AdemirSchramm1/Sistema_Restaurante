import type { Result } from "@/domain/shared/result";
import type { Decimal } from "@/domain/shared/decimal";
import type { UnitCode } from "@/domain/inventory/units";
import type { ComponentRef, RecipeLineData } from "@/domain/inventory/recipe";
import type { CancelReason, OrderStatus } from "@/domain/ordering/order";
import type { CatalogProduct, PricedLine } from "@/domain/ordering/checkout";
import type { MenuProductRow } from "@/domain/ordering/menu";
import type { MenuAccessEndReason } from "@/domain/ordering/menu-access";
import type { Audit } from "../access/ports";

/** Repositórios dos pedidos pelo QR code (spec 009) e dos adicionais (spec 010). */

export type DiningTableRecord = {
  id: string;
  name: string;
  active: boolean;
  qrToken: string;
  version: number;
};

export interface DiningTableRepo {
  list(includeInactive: boolean): Promise<DiningTableRecord[]>;
  get(id: string): Promise<DiningTableRecord | null>;
  /** Nomes normalizados das mesas ativas. */
  activeNames(): Promise<Set<string>>;
  insert(
    t: { id: string; name: string; normalized: string; qrToken: string },
    audit: Audit,
  ): Promise<Result<void>>;
  rename(id: string, name: string, normalized: string, version: number, audit: Audit): Promise<Result<void>>;
  setActive(id: string, active: boolean, version: number, audit: Audit): Promise<Result<void>>;
  rotateQr(id: string, qrToken: string, version: number, audit: Audit): Promise<Result<void>>;
}

export type MenuAccessRecord = {
  id: string;
  tableId: string;
  openedAt: Date;
  expiresAt: Date;
  endedAt: Date | null;
  endReason: MenuAccessEndReason | null;
};

export interface MenuAccessRepo {
  insert(
    a: Omit<MenuAccessRecord, "endReason"> & { tokenHash: string; ip: string | null; userAgent: string | null },
  ): Promise<void>;
  get(id: string): Promise<MenuAccessRecord | null>;
  end(id: string, at: Date, reason: MenuAccessEndReason): Promise<void>;
  /** Encerra os acessos ainda abertos da mesa (conta fechada, spec 011). Devolve quantos. */
  endOpenForTable(tableId: string, at: Date, reason: MenuAccessEndReason): Promise<number>;
}

export type OrderingSettings = {
  restaurantName: string;
  timezone: string;
  acceptingQrOrders: boolean;
  version: number;
};

export interface OrderingSettingsRepo {
  get(): Promise<OrderingSettings>;
  setAcceptingQrOrders(accepting: boolean, version: number, audit: Audit): Promise<Result<void>>;
}

/** Linha do pedido para as telas: produto, quantidade e as mudanças da 010 já em texto. */
export type OrderLineView = {
  quantity: number;
  productName: string;
  unitPrice: Decimal;
  changes: string[];
};

export type OrderRecord = {
  id: string;
  number: number;
  businessDay: string;
  tableId: string;
  tableName: string;
  menuAccessId: string;
  /** Conta da mesa (spec 011); nula nos pedidos de antes da 011. */
  tabId: string | null;
  status: OrderStatus;
  cancelReason: CancelReason | null;
  cancelNote: string | null;
  total: Decimal;
  submittedAt: Date;
  statusChangedAt: Date;
  version: number;
  lines: OrderLineView[];
};

export type OrderEventRecord = {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  reason: CancelReason | null;
  userName: string | null;
  at: Date;
};

export type NewOrder = {
  id: string;
  tableId: string;
  tabId: string;
  menuAccessId: string;
  clientRequestId: string;
  businessDay: string;
  total: Decimal;
  submittedAt: Date;
  lines: PricedLine[];
};

export type OrderFilter = {
  fromDay: string;
  toDay: string;
  tableId?: string;
  status?: OrderStatus;
};

export interface OrderRepo {
  findByClientRequest(menuAccessId: string, clientRequestId: string): Promise<OrderRecord | null>;
  countForAccess(menuAccessId: string): Promise<number>;
  /**
   * Reserva o número do dia (upsert com trava de linha) e grava pedido, linhas, escolhas e o
   * evento de situação. `null`: já existe pedido com este `clientRequestId` no acesso (nada fica
   * gravado, nem o número).
   */
  insert(o: NewOrder): Promise<{ number: number } | null>;
  get(id: string): Promise<OrderRecord | null>;
  events(id: string): Promise<OrderEventRecord[]>;
  /** Mais antigo primeiro. */
  listByStatus(statuses: readonly OrderStatus[]): Promise<OrderRecord[]>;
  /** Mais novo primeiro. */
  listForAccess(menuAccessId: string): Promise<OrderRecord[]>;
  /** Pedidos da conta, mais antigo primeiro (spec 011). */
  listForTab(tabId: string): Promise<OrderRecord[]>;
  list(filter: OrderFilter): Promise<OrderRecord[]>;
  /** Muda a situação com trava otimista e grava o evento. */
  changeStatus(
    id: string,
    change: { from: OrderStatus; to: OrderStatus; reason: CancelReason | null; note: string | null },
    version: number,
    audit: Audit,
  ): Promise<Result<void>>;
}

/** Produtos para o cardápio e para conferir o envio. */
export interface MenuRepo {
  /** Produtos vendidos (ativos ou não) com preço e esgotado, em ordem de nome. */
  products(): Promise<MenuProductRow[]>;
  /** Como cada produto pedido está agora, com opções da 010. */
  catalog(recipeIds: readonly string[], today: string): Promise<Map<string, CatalogProduct>>;
  setSoldOut(recipeId: string, day: string | null, audit: Audit): Promise<void>;
}

export type AddonRecord = {
  id: string;
  name: string;
  component: ComponentRef;
  componentName: string;
  componentActive: boolean;
  quantity: Decimal;
  unit: UnitCode;
  price: Decimal;
  active: boolean;
  version: number;
};

export type AddonWrite = {
  name: string;
  normalized: string;
  component: ComponentRef;
  quantity: Decimal;
  unit: UnitCode;
  price: Decimal;
};

export interface AddonRepo {
  list(includeInactive: boolean): Promise<AddonRecord[]>;
  get(id: string): Promise<AddonRecord | null>;
  getMany(ids: readonly string[]): Promise<AddonRecord[]>;
  insert(a: AddonWrite & { id: string }, audit: Audit): Promise<Result<void>>;
  update(id: string, a: AddonWrite, version: number, audit: Audit): Promise<Result<void>>;
  setActive(id: string, active: boolean, version: number, audit: Audit): Promise<Result<void>>;
  /** Produtos que oferecem este adicional. */
  usedBy(id: string): Promise<{ id: string; name: string }[]>;
}

export type ProductCustomizationRecord = {
  addons: { addonId: string; name: string; price: Decimal; maxTimes: number; active: boolean }[];
  removables: { component: ComponentRef; label: string }[];
};

export interface CustomizationRepo {
  get(recipeId: string): Promise<ProductCustomizationRecord>;
  /** Troca as duas listas do produto (a trava otimista é a do produto). */
  replace(
    recipeId: string,
    config: {
      addons: { addonId: string; maxTimes: number }[];
      removables: { component: ComponentRef; label: string }[];
    },
    version: number,
    audit: Audit,
  ): Promise<Result<void>>;
}

/** Escolhas de uma linha gravada, para o consumo (spec 010 US5). */
export type StoredLineChoices = {
  recipeId: string;
  recipeVersionId: string;
  /** Linhas da versão gravada no pedido (não a atual). */
  versionLines: RecipeLineData[];
  quantity: number;
  addons: { component: ComponentRef; quantity: Decimal; unit: UnitCode; times: number }[];
  removals: ComponentRef[];
};

export interface OrderChoicesRepo {
  forOrder(orderId: string): Promise<StoredLineChoices[] | null>;
}

export type OrderingRepos = {
  tables: DiningTableRepo;
  menuAccesses: MenuAccessRepo;
  orderingSettings: OrderingSettingsRepo;
  orders: OrderRepo;
  menu: MenuRepo;
  addons: AddonRepo;
  customization: CustomizationRepo;
  orderChoices: OrderChoicesRepo;
};

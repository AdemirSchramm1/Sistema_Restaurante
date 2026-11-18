import type { Result } from "@/domain/shared/result";
import type { Decimal } from "@/domain/shared/decimal";
import type { UnitCode } from "@/domain/inventory/units";
import type { ComponentRef, RecipeLineData } from "@/domain/inventory/recipe";
import type { CancelReason, OrderSource, OrderStatus } from "@/domain/ordering/order";
import type { CatalogProduct, PricedLine } from "@/domain/ordering/checkout";
import type { MenuProductRow } from "@/domain/ordering/menu";
import type { MenuAccessEndReason, MenuAccessKind } from "@/domain/ordering/menu-access";
import type { Audit } from "../access/ports";
import type { Appearance } from "../menu/ports";

/** Repositórios dos pedidos pelo QR code (spec 009) e dos adicionais (spec 010). */

export type DiningTableRecord = {
  id: string;
  name: string;
  active: boolean;
  qrToken: string;
  /** Link do tablet fixo na mesa (spec 016); nulo até o gerente criar. */
  tabletToken: string | null;
  version: number;
};

/** Mesa ativa com o link e o tablet ligado, para a tela Mesas (spec 016, US4-8). */
export type TabletStatusRow = {
  tableId: string;
  name: string;
  tabletToken: string | null;
  version: number;
  boundAt: Date | null;
  lastSeenAt: Date | null;
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
  /** Cria ou troca o link do tablet (spec 016); soma 1 na versão. */
  setTabletToken(id: string, tabletToken: string, version: number, audit: Audit): Promise<Result<void>>;
  /** Mesas ativas com o tablet aberto de cada uma, em uma consulta (spec 016). */
  tabletStatus(): Promise<TabletStatusRow[]>;
}

export type MenuAccessRecord = {
  id: string;
  tableId: string;
  /** QR code (20 minutos) ou tablet fixo na mesa (sem prazo, spec 016). */
  kind: MenuAccessKind;
  openedAt: Date;
  /** Nulo só no tablet. */
  expiresAt: Date | null;
  endedAt: Date | null;
  endReason: MenuAccessEndReason | null;
  /** Sinal de vida do tablet (spec 016); sempre nulo no QR code. */
  lastSeenAt: Date | null;
};

export type NewTabletAccess = {
  id: string;
  tableId: string;
  tokenHash: string;
  openedAt: Date;
  ip: string | null;
  userAgent: string | null;
};

export interface MenuAccessRepo {
  insert(
    a: Omit<MenuAccessRecord, "endReason" | "lastSeenAt"> & {
      tokenHash: string;
      ip: string | null;
      userAgent: string | null;
    },
  ): Promise<void>;
  get(id: string): Promise<MenuAccessRecord | null>;
  end(id: string, at: Date, reason: MenuAccessEndReason): Promise<void>;
  /** Encerra os acessos do QR code ainda abertos da mesa (conta fechada, spec 011; R6 da 016). */
  endOpenForTable(tableId: string, at: Date, reason: MenuAccessEndReason): Promise<number>;
  /** Liga o tablet; `false` quando a mesa já tem um aberto (único `menu_accesses_one_tablet`). */
  insertTablet(a: NewTabletAccess): Promise<boolean>;
  /** O acesso do tablet aberto da mesa, ou nulo. */
  openTablet(tableId: string): Promise<MenuAccessRecord | null>;
  /** Grava o sinal de vida só quando o gravado tem mais de 60 s; diz se gravou. */
  touch(id: string, now: Date): Promise<boolean>;
}

export type OrderingSettings = {
  restaurantName: string;
  timezone: string;
  acceptingQrOrders: boolean;
  version: number;
  /** Logo e capa (spec 016), lidos junto para o cardápio não ir ao banco de novo. */
  appearance: Appearance;
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
  /** Observação para a cozinha (spec 015, FR-018). */
  kitchenNote: string | null;
  /** As escolhas como foram gravadas, para Pedir de novo (spec 015, R20). */
  recipeId: string;
  addons: { addonId: string; times: number }[];
  removals: ComponentRef[];
};

export type OrderRecord = {
  id: string;
  number: number;
  businessDay: string;
  tableId: string;
  tableName: string;
  /** Só no pedido pelo QR code (spec 015). */
  menuAccessId: string | null;
  /** Conta da mesa (spec 011); nula nos pedidos de antes da 011. */
  tabId: string | null;
  /** Origem e quem lançou (spec 015, FR-006); o nome é o de hoje. */
  source: OrderSource;
  placedById: string | null;
  placedByName: string | null;
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
  /** QR code: o acesso do celular. Equipe: quem lançou (spec 015, R1). */
  origin: { source: "QR"; menuAccessId: string } | { source: "STAFF"; placedBy: string };
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
  /** "QR" ou o id de quem lançou (spec 015, FR-008). */
  placedBy?: string;
};

/** Resumo por origem no período (spec 015, US2-6). */
export type SourceSummaryRow = {
  source: OrderSource;
  placedById: string | null;
  name: string | null;
  count: number;
  total: Decimal;
  cancelled: { reason: CancelReason; count: number }[];
};

export interface OrderRepo {
  findByClientRequest(menuAccessId: string, clientRequestId: string): Promise<OrderRecord | null>;
  /** O envio da equipe já gravado (spec 015, R2). */
  findStaffByClientRequest(placedBy: string, clientRequestId: string): Promise<OrderRecord | null>;
  /** Por origem, no filtro (sem o filtro de situação): não cancelados e cancelados por motivo. */
  summaryBySource(filter: OrderFilter): Promise<SourceSummaryRow[]>;
  /** Quem já lançou pedido (para o filtro Lançado por). */
  staffPlacers(): Promise<{ id: string; name: string }[]>;

  countForAccess(menuAccessId: string): Promise<number>;
  /**
   * Reserva o número do dia (upsert com trava de linha) e grava pedido, linhas, escolhas e o
   * evento de situação. `null`: já existe pedido com este `clientRequestId` no acesso, ou da mesma
   * pessoa da equipe (nada fica gravado, nem o número).
   */
  insert(o: NewOrder): Promise<{ number: number } | null>;
  get(id: string): Promise<OrderRecord | null>;
  events(id: string): Promise<OrderEventRecord[]>;
  /** Mais antigo primeiro. */
  listByStatus(statuses: readonly OrderStatus[]): Promise<OrderRecord[]>;
  /** Mais novo primeiro. */
  listForAccess(menuAccessId: string): Promise<OrderRecord[]>;
  /** Pedidos da conta, mais antigo primeiro (spec 011). */
  /**
   * Conta aberta da mesa e um carimbo que muda com o nome e a situação da mesa, a aparência e a
   * chave do restaurante, a conta e a situação dos pedidos dela (spec 016, R5). Uma ida ao banco.
   */
  tabletStamp(tableId: string): Promise<{ tabId: string | null; stamp: string }>;
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
  /** Produtos vendidos (ativos ou não) com preço e esgotado, na ordem do cardápio (seção e posição). */
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

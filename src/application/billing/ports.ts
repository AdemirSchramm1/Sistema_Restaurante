import type { Result } from "@/domain/shared/result";
import type { Decimal } from "@/domain/shared/decimal";
import type { PaymentMethod } from "@/domain/billing/payment";
import type { TabOrder, TabPayment } from "@/domain/billing/tab";
import type { Audit } from "../access/ports";

/** Repositórios da conta da mesa (spec 011, data-model.md). */

export type TabStatus = "OPEN" | "CLOSED";
export type TabEventKind =
  | "OPENED"
  | "PAYMENT_ADDED"
  | "PAYMENT_REMOVED"
  | "SERVICE_WAIVED"
  | "SERVICE_RESTORED"
  | "CLOSED"
  | "REOPENED";

/** Valores gravados no fechamento (retrato para a consulta). */
export type ClosedTotals = { subtotal: Decimal; serviceCharge: Decimal; total: Decimal };

export type TabRecord = {
  id: string;
  tableId: string;
  tableName: string;
  status: TabStatus;
  openedAt: Date;
  serviceRate: Decimal | null;
  serviceWaived: boolean;
  closedAt: Date | null;
  closedByName: string | null;
  closedDay: string | null;
  closedTotals: ClosedTotals | null;
  version: number;
};

export type TabPaymentRecord = {
  id: string;
  method: PaymentMethod;
  amount: Decimal;
  received: Decimal | null;
  change: Decimal | null;
  at: Date;
  byName: string | null;
  removedAt: Date | null;
  removedByName: string | null;
};

export type TabEventRecord = {
  kind: TabEventKind;
  reason: string | null;
  details: Record<string, unknown> | null;
  userName: string | null;
  at: Date;
};

/** Conta aberta com o que o domínio precisa para o total. */
export type OpenTabRow = {
  id: string;
  tableId: string;
  tableName: string;
  openedAt: Date;
  serviceRate: Decimal | null;
  serviceWaived: boolean;
  version: number;
  orders: TabOrder[];
  payments: TabPayment[];
};

export type ClosedTabRow = {
  id: string;
  tableId: string;
  tableName: string;
  openedAt: Date;
  closedAt: Date;
  closedDay: string;
  closedByName: string | null;
  subtotal: Decimal;
  serviceCharge: Decimal;
  total: Decimal;
};

/** Dias locais do fechamento, de/até, e mesa opcional. */
export type TabFilter = { fromDay: string; toDay: string; tableId?: string };

export type NewPayment = {
  id: string;
  tabId: string;
  method: PaymentMethod;
  amount: Decimal;
  received: Decimal | null;
  change: Decimal | null;
  clientRequestId: string;
  /** Turno do caixa em que o pagamento entrou (spec 014). */
  cashSessionId: string;
};

export type NewTabEvent = {
  id: string;
  tabId: string;
  kind: TabEventKind;
  reason?: string | null;
  details?: Record<string, unknown> | null;
  userId: string | null;
  at: Date;
};

export interface TabRepo {
  /**
   * Conta aberta da mesa, travada até o fim da transação; abre uma (com a taxa dada) se não houver.
   * Dois envios ao mesmo tempo abrem uma conta só. Conta que já existia ganha +1 na versão.
   */
  openForOrder(
    tableId: string,
    at: Date,
    serviceRate: Decimal | null,
  ): Promise<{ id: string; opened: boolean }>;
  get(id: string): Promise<TabRecord | null>;
  /** Conta travada até o fim da transação (SELECT … FOR UPDATE). */
  lock(id: string): Promise<TabRecord | null>;
  /** +1 na versão: algo da conta mudou (pagamento, pedido cancelado). */
  touch(id: string, audit: Audit): Promise<void>;
  listOpen(): Promise<OpenTabRow[]>;
  payments(tabId: string): Promise<TabPaymentRecord[]>;
  events(tabId: string): Promise<TabEventRecord[]>;
  paymentByClientRequest(tabId: string, clientRequestId: string): Promise<TabPaymentRecord | null>;
  getPayment(tabId: string, paymentId: string): Promise<TabPaymentRecord | null>;
  insertPayment(p: NewPayment, audit: Audit): Promise<void>;
  /** `ALREADY_REMOVED` se já foi tirado. A remoção guarda o turno do caixa em que foi feita. */
  removePayment(paymentId: string, id: string, cashSessionId: string, audit: Audit): Promise<Result<void>>;
  addEvent(e: NewTabEvent): Promise<void>;
  /** Na conta já travada; +1 na versão. */
  setServiceWaived(id: string, waived: boolean, audit: Audit): Promise<void>;
  /** `cashSessionId`: turno do caixa aberto na hora de fechar; nulo se não há (conta de R$ 0,00). */
  close(
    id: string,
    snapshot: ClosedTotals & { closedDay: string; cashSessionId: string | null },
    audit: Audit,
  ): Promise<void>;
  /** Quantas mesas têm conta aberta (aviso do fechamento do caixa, spec 014). */
  countOpen(): Promise<number>;
  /** `TABLE_HAS_OPEN_TAB` se a mesa já tem outra conta aberta. */
  reopen(id: string, audit: Audit): Promise<Result<void>>;
  listClosed(filter: TabFilter): Promise<ClosedTabRow[]>;
  /** Pagamentos não tirados das contas fechadas no período, por forma. */
  paidByMethod(filter: TabFilter): Promise<{ method: PaymentMethod; amount: Decimal }[]>;
}

export type BillingSettings = { serviceChargeRate: Decimal | null; version: number };

export interface BillingSettingsRepo {
  get(): Promise<BillingSettings>;
  setServiceChargeRate(rate: Decimal | null, version: number, audit: Audit): Promise<Result<void>>;
}

export type BillingRepos = { tabs: TabRepo; billingSettings: BillingSettingsRepo };

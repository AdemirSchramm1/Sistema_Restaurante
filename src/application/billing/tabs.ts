import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import type { TabEventRecord, TabPaymentRecord, TabStatus } from "./ports";
import type { OrderLineView } from "../ordering/ports";
import type { CancelReason, OrderStatus } from "@/domain/ordering/order";
import type { CloseBlocker } from "@/domain/billing/tab";
import type { Decimal } from "@/domain/shared/decimal";
import { err, type Result } from "@/domain/shared/result";

/** Esqueleto (vermelho). */

export type OpenTabView = {
  id: string;
  tableName: string;
  openedAt: Date;
  total: Decimal;
  paid: Decimal;
  remaining: Decimal;
  pendingOrders: number;
  version: number;
};

export type TabOrderView = {
  id: string;
  number: number;
  status: OrderStatus;
  cancelReason: CancelReason | null;
  cancelNote: string | null;
  total: Decimal;
  submittedAt: Date;
  lines: OrderLineView[];
};

export type TabView = {
  id: string;
  tableId: string;
  tableName: string;
  restaurantName: string;
  status: TabStatus;
  openedAt: Date;
  closedAt: Date | null;
  closedByName: string | null;
  version: number;
  orders: TabOrderView[];
  subtotal: Decimal;
  serviceRate: Decimal | null;
  serviceWaived: boolean;
  serviceCharge: Decimal;
  total: Decimal;
  paid: Decimal;
  remaining: Decimal;
  pendingOrders: number;
  canClose: boolean;
  blockers: CloseBlocker[];
  payments: TabPaymentRecord[];
  events: TabEventRecord[];
  serverNow: string;
};

export async function listOpenTabs(
  _deps: Deps,
  _ctx: RequestContext,
): Promise<Result<{ tabs: OpenTabView[]; serverNow: string }>> {
  return err("VALIDATION");
}

export async function getTab(_deps: Deps, _ctx: RequestContext, _id: string): Promise<Result<TabView>> {
  return err("VALIDATION");
}

import type { CancelReason, OrderStatus } from "@/domain/ordering/order";
import type { CloseBlocker } from "@/domain/billing/tab";
import type { PaymentMethod } from "@/domain/billing/payment";

/** Esqueleto (vermelho). */
export type TabDetailView = {
  id: string;
  tableName: string;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt: string | null;
  closedByName: string | null;
  orders: {
    id: string;
    number: number;
    status: OrderStatus;
    cancelReason: CancelReason | null;
    cancelNote: string | null;
    total: string;
    lines: { quantity: number; productName: string; unitPrice: string; changes: string[] }[];
  }[];
  subtotal: string;
  serviceRate: string | null;
  serviceWaived: boolean;
  serviceCharge: string;
  total: string;
  paid: string;
  remaining: string;
  pendingOrders: number;
  blockers: CloseBlocker[];
  payments: {
    id: string;
    method: PaymentMethod;
    amount: string;
    received: string | null;
    change: string | null;
    at: string;
    byName: string | null;
    removedAt: string | null;
    removedByName: string | null;
  }[];
  events: { kind: string; reason: string | null; userName: string | null; at: string }[];
};
export function TabDetail(_props: { tab: TabDetailView; timezone: string }) {
  return null;
}

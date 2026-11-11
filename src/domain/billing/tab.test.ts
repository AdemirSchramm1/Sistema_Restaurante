import { describe, it, expect } from "vitest";
import { checkClose, closeBlockers, isPendingOrder, tabTotals, type TabTotals } from "./tab";
import { d } from "../shared/decimal";
import type { OrderStatus } from "../ordering/order";

const order = (status: OrderStatus, total: string) => ({ status, total: d(total) });
const pay = (amount: string, removed = false) => ({ amount: d(amount), removed });
const money = (t: TabTotals) =>
  Object.fromEntries(Object.entries(t).map(([k, v]) => [k, (v as { toFixed(n: number): string }).toFixed(2)]));
const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "OK" : r.error!.code);

/** Mesa 12: 2 × X-Burger com queijo (R$ 68,00) e 1 Suco (R$ 9,00); um suco cancelado. */
const mesa12 = [order("DELIVERED", "68.00"), order("DELIVERED", "9.00"), order("CANCELLED", "9.00")];

describe("total da conta da mesa (spec 011, US1 e FR-002)", () => {
  it("subtotal soma os pedidos menos os cancelados; total = subtotal + taxa", () => {
    const t = tabTotals({ orders: mesa12, payments: [], serviceRate: d("10"), serviceWaived: false });
    expect(money(t)).toEqual({
      subtotal: "77.00",
      serviceCharge: "7.70",
      total: "84.70",
      paid: "0.00",
      remaining: "84.70",
    });
  });

  it("pedido ainda não entregue entra no total", () => {
    const t = tabTotals({
      orders: [order("RECEIVED", "68.00"), order("PREPARING", "9.00"), order("READY", "3.00")],
      payments: [],
      serviceRate: null,
      serviceWaived: false,
    });
    expect(t.subtotal.toFixed(2)).toBe("80.00");
    expect(t.total.toFixed(2)).toBe("80.00");
  });

  it("pago ignora pagamento tirado; falta = total − pago", () => {
    const t = tabTotals({
      orders: mesa12,
      payments: [pay("40.00"), pay("10.00", true), pay("4.70")],
      serviceRate: d("10"),
      serviceWaived: false,
    });
    expect(t.paid.toFixed(2)).toBe("44.70");
    expect(t.remaining.toFixed(2)).toBe("40.00");
  });

  it("taxa tirada da conta: total = subtotal", () => {
    const t = tabTotals({ orders: mesa12, payments: [], serviceRate: d("10"), serviceWaived: true });
    expect(t.serviceCharge.toFixed(2)).toBe("0.00");
    expect(t.total.toFixed(2)).toBe("77.00");
  });

  it("conta sem pedido nenhum: tudo zero", () => {
    const t = tabTotals({ orders: [], payments: [], serviceRate: d("10"), serviceWaived: false });
    expect(money(t)).toEqual({
      subtotal: "0.00",
      serviceCharge: "0.00",
      total: "0.00",
      paid: "0.00",
      remaining: "0.00",
    });
  });
});

describe("fechar a conta (spec 011, US2 e FR-004)", () => {
  const totals = (payments: ReturnType<typeof pay>[], orders = mesa12) =>
    tabTotals({ orders, payments, serviceRate: null, serviceWaived: false });

  it("Recebido, Em preparo e Pronto estão em aberto; Entregue e Cancelado não", () => {
    expect((["RECEIVED", "PREPARING", "READY"] as OrderStatus[]).every(isPendingOrder)).toBe(true);
    expect((["DELIVERED", "CANCELLED"] as OrderStatus[]).some(isPendingOrder)).toBe(false);
  });

  it("fecha com falta R$ 0,00 e todos os pedidos entregues ou cancelados", () => {
    expect(code(checkClose(totals([pay("77.00")]), mesa12))).toBe("OK");
  });

  it("ainda falta pagar: REMAINING_NOT_ZERO com quanto falta", () => {
    const r = checkClose(totals([pay("65.00")]), mesa12);
    expect(code(r)).toBe("REMAINING_NOT_ZERO");
    if (!r.ok) expect(r.error.details).toEqual({ remaining: "12.00" });
  });

  it("pedido ainda não entregue: PENDING_ORDERS com quantos", () => {
    const orders = [...mesa12, order("READY", "9.00"), order("PREPARING", "9.00")];
    const r = checkClose(totals([pay("95.00")], orders), orders);
    expect(code(r)).toBe("PENDING_ORDERS");
    if (!r.ok) expect(r.error.details).toEqual({ pending: 2 });
  });

  it("a tela recebe os dois motivos de uma vez", () => {
    const orders = [...mesa12, order("RECEIVED", "9.00")];
    expect(closeBlockers(totals([], orders), orders)).toEqual(["REMAINING_NOT_ZERO", "PENDING_ORDERS"]);
    expect(closeBlockers(totals([pay("77.00")]), mesa12)).toEqual([]);
  });

  it("conta com todos os pedidos cancelados fecha com R$ 0,00, sem pagamento", () => {
    const orders = [order("CANCELLED", "68.00")];
    expect(code(checkClose(totals([], orders), orders))).toBe("OK");
  });
});

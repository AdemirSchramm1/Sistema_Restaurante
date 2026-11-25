import type { Deps, Repos } from "../ports";
import type { RequestContext } from "../context";
import { registerLoss, registerPurchase, requestAdjustment, decideAdjustment } from "../inventory/movements";
import { placeStaffOrder, listTableOrders } from "../ordering/staff-orders";
import { advanceOrderStatus, cancelOrder, markDelivered } from "../ordering/kitchen";
import { addPayment } from "../billing/payments";
import { closeTab, getTab } from "../billing/tabs";
import { openCashSession } from "../cash/sessions";
import { addCashEntry } from "../cash/entries";
import { closeCashSession, countCash } from "../cash/closing";
import { DEMO_DISHES, DEMO_ITEMS, DEMO_KITCHEN_NOTES, DEMO_SUPPLIERS, type DemoDish } from "./catalog";
import { seededRandom, type Random } from "./random";
import { localTime, must, type SeedClock } from "./shared";
import { MOVEMENT_REASONS } from "@/domain/inventory/movement-reasons";
import type { PaymentMethod } from "@/domain/billing/payment";
import { d, Decimal } from "@/domain/shared/decimal";
import { ok } from "@/domain/shared/result";

/**
 * O dia a dia do restaurante de exemplo (spec 017): compras de manhã, salão no almoço e no jantar,
 * cozinha, contas, caixa e perdas. Cada dia vira uma fila de eventos com horário; o relógio vai
 * para o horário de cada um antes de chamar o caso de uso. O que cairia depois de `now` não acontece:
 * hoje fica com o caixa aberto e mesas no meio do atendimento.
 */

export type DemoRestaurant = {
  items: Map<string, string>;
  suppliers: Map<string, string>;
  dishes: Map<string, string>;
  addons: Map<string, { id: string; price: string }>;
  tables: { id: string; name: string }[];
  owner: RequestContext;
  chef: RequestContext;
  cook: RequestContext;
  waiters: RequestContext[];
  cashier: RequestContext;
  stock: RequestContext;
};

type HistoryEnv = { deps: Deps; clock: SeedClock; log: (m: string) => void };
type Event = { at: Date; seq: number; run: () => Promise<void> };
type Service = "lunch" | "dinner";

const MIN = 60_000;
const OPENING_FLOAT = d("200.00");
const plus = (at: Date, minutes: number) => new Date(at.getTime() + minutes * MIN);
const reason = (type: string, code: string) =>
  MOVEMENT_REASONS.find((r) => r.movementType === type && r.code === code)!.id;
const nextDay = (day: string) => {
  const t = new Date(`${day}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
};
/** 0 = domingo … 6 = sábado. */
const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

/** Movimento por dia da semana: mesas no almoço e no jantar (segunda fechado). */
const SCHEDULE: Record<number, { lunch: [number, number]; dinner: [number, number] | null }> = {
  0: { lunch: [22, 26], dinner: null },
  2: { lunch: [15, 19], dinner: [7, 10] },
  3: { lunch: [15, 19], dinner: [7, 10] },
  4: { lunch: [16, 20], dinner: [8, 11] },
  5: { lunch: [17, 21], dinner: [14, 17] },
  6: { lunch: [18, 22], dinner: [16, 20] },
};

const LOSSES: { item: string; qty: string; code: string; note: string }[] = [
  { item: "tomate", qty: "1.2", code: "SPOILED", note: "Caixa com tomates machucados" },
  { item: "alface", qty: "2", code: "SPOILED", note: "Murchou na câmara" },
  { item: "longneck", qty: "1", code: "DROPPED", note: "Garrafa caiu no salão" },
  { item: "picanha", qty: "0.25", code: "PREP_TRIM", note: "Gordura acima do normal" },
  { item: "frango", qty: "0.4", code: "PREP_ERROR", note: "Passou do ponto" },
  { item: "leite", qty: "1", code: "EXPIRED", note: "Venceu na geladeira" },
  { item: "fritas", qty: "0.5", code: "BURNT", note: "Óleo muito quente" },
];

/** Itens contados na segunda de manhã, três por semana. */
const COUNTED = [
  "picanha",
  "contrafile",
  "chope",
  "mussarela",
  "bacon",
  "coca",
  "longneck",
  "frango",
  "arroz",
];

export async function runHistory(
  env: HistoryEnv,
  r: DemoRestaurant,
  span: { firstDay: string; today: string; now: Date },
): Promise<void> {
  const { deps, clock, log } = env;
  const rnd = seededRandom(20261125);
  const rid = r.owner.restaurantId;
  const read = async <T>(fn: (repos: Repos) => Promise<T>) =>
    must(await deps.tenant(rid, async (repos) => ok(await fn(repos))), "leitura");
  const balances = () =>
    read(async (repos) => {
      const out = new Map<string, Decimal>();
      for (const [key, id] of r.items) out.set(key, await repos.items.balance(id));
      return out;
    });

  /** Maior consumo de um dia já visto, por item: é por ele que o comprador decide. */
  const usage = new Map<string, Decimal>();
  /** Dinheiro recebido no turno aberto (o troco da abertura e as sangrias ficam no turno). */
  const cashState = { expected: d(0) };
  let weeks = 0;
  let lossTurn = 0;

  for (let day = span.firstDay; day <= span.today; day = nextDay(day)) {
    const dow = weekday(day);
    const at = (hhmm: string) => localTime(day, hhmm);
    const events: Event[] = [];
    let seq = 0;
    const schedule = (when: Date, run: () => Promise<void>) => events.push({ at: when, seq: seq++, run });

    schedule(at("08:30"), () => (day === span.firstDay ? openingPurchase() : restock(dow)));
    const hours = SCHEDULE[dow];
    if (!hours) {
      schedule(at("10:00"), () => weeklyCount(weeks++));
    } else {
      let start: Map<string, Decimal> | null = null;
      schedule(at("10:55"), async () => {
        start = await balances();
      });
      const closeAt = hours.dinner ? at("23:55") : at("16:30");
      const cash = { sessionId: "", expected: OPENING_FLOAT };
      schedule(at("11:00"), async () => {
        cash.sessionId = must(
          await openCashSession(deps, r.cashier, {
            openingFloat: OPENING_FLOAT,
            note: null,
            clientRequestId: deps.ids.next(),
          }),
          "abrir o caixa",
        ).id;
      });
      const busy = new Map<string, Date>(r.tables.map((t) => [t.id, at("00:00")]));
      planService(rnd, "lunch", at("11:40"), 140, rnd.int(...hours.lunch), closeAt);
      if (hours.dinner) planService(rnd, "dinner", at("19:00"), 160, rnd.int(...hours.dinner), closeAt);
      // Hoje, com a casa aberta: algumas mesas chegaram há pouco e ainda estão no meio do atendimento.
      if (day === span.today && span.now >= at("11:30") && span.now < plus(closeAt, -30)) {
        const service: Service = span.now < at("17:00") ? "lunch" : "dinner";
        planService(rnd, service, plus(span.now, -45), 40, 5, closeAt);
      }
      schedule(at("15:40"), () => loss(LOSSES[lossTurn++ % LOSSES.length]!));
      schedule(at("16:10"), () => withdrawals(cash));
      schedule(closeAt, () => closeCash(cash));
      schedule(plus(closeAt, 1), async () => {
        if (!start) return;
        const end = await balances();
        for (const [key, before] of start) {
          const used = before.minus(end.get(key)!);
          if (used.gt(usage.get(key) ?? 0)) usage.set(key, used);
        }
      });

      function planService(
        rnd: Random,
        service: Service,
        from: Date,
        windowMinutes: number,
        tabs: number,
        sessionClose: Date,
      ): void {
        const arrivals = Array.from({ length: tabs }, () => plus(from, rnd.int(0, windowMinutes))).sort(
          (a, b) => a.getTime() - b.getTime(),
        );
        for (const arrival of arrivals) {
          const free = r.tables.filter((t) => busy.get(t.id)! <= arrival);
          if (!free.length) continue;
          const table = rnd.pick(free);
          const plan = planTab(rnd, service, table, arrival);
          if (plan.closeAt >= plus(sessionClose, -10)) continue;
          busy.set(table.id, plus(plan.closeAt, 5));
          plan.events.forEach((e) => schedule(e.at, e.run));
        }
      }
    }

    events.sort((a, b) => a.at.getTime() - b.at.getTime() || a.seq - b.seq);
    let done = 0;
    for (const e of events) {
      if (e.at > span.now) break;
      clock.set(e.at);
      await e.run();
      done += 1;
    }
    log(`  ${day}: ${done} lançamentos`);
  }

  // ---------------------------------------------------------------------------------------------
  // Salão: uma mesa do começo ao fim.

  function planTab(rnd: Random, service: Service, table: { id: string; name: string }, arrival: Date) {
    const events: { at: Date; run: () => Promise<void> }[] = [];
    const waiter = r.waiters[(Number.parseInt(table.name, 10) - 1) % 2 === 0 ? 0 : 1] ?? r.owner;
    const party = rnd.weighted(
      service === "lunch" ? [1, 1, 2, 2, 2, 3, 4] : [2, 2, 2, 3, 4, 4, 5, 6],
      () => 1,
    );

    const lifecycle = (start: Date, lines: OrderLine[]) => {
      const drinksOnly = lines.every((l) => l.dish.role === "drink");
      const ref = { id: "" };
      const prep = plus(start, rnd.int(1, 4));
      const ready = plus(prep, drinksOnly ? rnd.int(2, 4) : rnd.int(10, 22));
      const delivered = plus(ready, rnd.int(1, 4));
      events.push({ at: start, run: async () => void (ref.id = await place(waiter, table.id, lines)) });
      events.push({ at: prep, run: () => advance(table.id, ref.id, "PREPARING") });
      events.push({ at: ready, run: () => advance(table.id, ref.id, "READY") });
      events.push({ at: delivered, run: () => deliver(waiter, table.id, ref.id) });
      return delivered;
    };

    const first = plus(arrival, rnd.int(3, 8));
    if (rnd.chance(0.03)) {
      // Lançou na mesa errada, ou o item errado: cancela na hora e lança de novo.
      const wrong = { id: "" };
      const drink = pickDish(rnd, service, "drink");
      events.push({
        at: plus(first, -1),
        run: async () => void (wrong.id = await place(waiter, table.id, [simpleLine(drink, 1)])),
      });
      events.push({ at: first, run: () => cancel(waiter, table.id, wrong.id) });
    }
    let last = lifecycle(first, firstRound(rnd, service, party));
    const secondChance = service === "dinner" ? 0.6 : 0.4;
    if (rnd.chance(secondChance)) {
      const second = plus(last, rnd.int(12, 30));
      last = lifecycle(second, secondRound(rnd, service, party));
    }

    const payAt = plus(last, rnd.int(8, 22));
    const split = party >= 2 && rnd.chance(0.22);
    const methods: PaymentMethod[] = [paymentMethod(rnd)];
    if (split) methods.push(paymentMethod(rnd));
    methods.forEach((method, i) =>
      events.push({ at: plus(payAt, i), run: () => pay(table.id, method, i === 0 && split ? 2 : 1, rnd) }),
    );
    const closeAt = plus(payAt, methods.length + 1);
    events.push({ at: closeAt, run: () => closeTable(table.id) });
    return { events, closeAt };
  }

  type OrderLine = {
    dish: DemoDish;
    quantity: number;
    addons: string[];
    removals: string[];
    note: string | null;
  };
  function simpleLine(dish: DemoDish, quantity: number): OrderLine {
    return { dish, quantity, addons: [], removals: [], note: null };
  }

  function pickDish(rnd: Random, service: Service, role: DemoDish["role"]) {
    return rnd.weighted(
      DEMO_DISHES.filter((x) => x.role === role),
      (x) => x[service],
    );
  }

  /** Junta pedidos iguais numa linha; com adicional, retirada ou observação, cada um na sua. */
  function merge(lines: OrderLine[]): OrderLine[] {
    const out: OrderLine[] = [];
    for (const l of lines) {
      const plain = !l.addons.length && !l.removals.length && !l.note;
      const same =
        plain && out.find((o) => o.dish === l.dish && !o.addons.length && !o.removals.length && !o.note);
      if (same) same.quantity += l.quantity;
      else out.push({ ...l });
    }
    return out;
  }

  function firstRound(rnd: Random, service: Service, party: number): OrderLine[] {
    const lines: OrderLine[] = [];
    if (service === "dinner" && party >= 2 && rnd.chance(0.5))
      lines.push(simpleLine(pickDish(rnd, service, "starter"), 1));
    let sharedPicanha = false;
    for (let p = 0; p < party; p++) {
      const main = pickDish(rnd, service, "main");
      if (main.key === "picanha") {
        // Prato para dois: um a cada dois clientes que escolhem.
        if (sharedPicanha) {
          sharedPicanha = false;
        } else {
          sharedPicanha = true;
          lines.push(simpleLine(main, 1));
        }
      } else {
        const line = simpleLine(main, 1);
        if ((main.key === "xburger" || main.key === "xbacon") && rnd.chance(0.3)) {
          if (rnd.chance(0.5))
            line.addons.push(main.key === "xburger" ? rnd.pick(["bacon", "queijo"]) : "queijo");
          else line.removals.push(rnd.pick(["tomate", "alface"]));
        }
        const notes = DEMO_KITCHEN_NOTES[main.key];
        if (notes && rnd.chance(0.15)) line.note = rnd.pick(notes);
        lines.push(line);
      }
      if (rnd.chance(0.8)) lines.push(simpleLine(pickDish(rnd, service, "drink"), 1));
    }
    return merge(lines);
  }

  function secondRound(rnd: Random, service: Service, party: number): OrderLine[] {
    const lines: OrderLine[] = [];
    for (let p = 0; p < party; p++) {
      if (service === "lunch" ? rnd.chance(0.55) : rnd.chance(0.25))
        lines.push(simpleLine(pickDish(rnd, service, "dessert"), 1));
      if (service === "dinner" ? rnd.chance(0.75) : rnd.chance(0.2))
        lines.push(simpleLine(pickDish(rnd, service, "drink"), 1));
    }
    if (!lines.length) lines.push(simpleLine(pickDish(rnd, service, "drink"), 1));
    return merge(lines);
  }

  function paymentMethod(rnd: Random): PaymentMethod {
    return rnd.weighted(
      [
        ["PIX", 36],
        ["CREDIT_CARD", 30],
        ["DEBIT_CARD", 20],
        ["CASH", 14],
      ] as const,
      ([, w]) => w,
    )[0];
  }

  // ---------------------------------------------------------------------------------------------
  // Casos de uso.

  async function place(waiter: RequestContext, tableId: string, lines: OrderLine[]): Promise<string> {
    const placed = await placeStaffOrder(deps, waiter, {
      tableId,
      clientRequestId: deps.ids.next(),
      tabIdSeen: null,
      lines: lines.map((l) => {
        const addons = l.addons.map((key) => r.addons.get(key)!);
        const unitPrice = addons.reduce((s, a) => s.plus(a.price), d(l.dish.price));
        return {
          recipeId: r.dishes.get(l.dish.key)!,
          quantity: l.quantity,
          unitPrice: unitPrice.toFixed(2),
          addons: addons.map((a) => ({ addonId: a.id, times: 1, unitPrice: d(a.price).toFixed(2) })),
          removals: l.removals.map((key) => ({ kind: "ITEM" as const, id: r.items.get(key)! })),
          kitchenNote: l.note,
        };
      }),
    });
    return must(placed, "lançar o pedido").orderId;
  }

  async function tableView(tableId: string) {
    return must(await listTableOrders(deps, r.owner, tableId), "pedidos da mesa");
  }

  async function versionOf(tableId: string, orderId: string) {
    return (await tableView(tableId)).orders.find((o) => o.id === orderId)!.version;
  }

  async function advance(tableId: string, orderId: string, to: "PREPARING" | "READY") {
    const cook = to === "PREPARING" ? r.chef : rnd.pick([r.chef, r.cook]);
    must(
      await advanceOrderStatus(deps, cook, { id: orderId, to, version: await versionOf(tableId, orderId) }),
      `pedido ${to}`,
    );
  }

  async function deliver(waiter: RequestContext, tableId: string, orderId: string) {
    must(
      await markDelivered(deps, waiter, { id: orderId, version: await versionOf(tableId, orderId) }),
      "entregar o pedido",
    );
  }

  async function cancel(waiter: RequestContext, tableId: string, orderId: string) {
    must(
      await cancelOrder(deps, waiter, {
        id: orderId,
        reason: "ENTERED_BY_MISTAKE",
        note: null,
        version: await versionOf(tableId, orderId),
      }),
      "cancelar o pedido",
    );
  }

  /** Paga o que falta (ou a parte de uma das `parts` pessoas); dinheiro com troco redondo. */
  async function pay(tableId: string, method: PaymentMethod, parts: number, rnd: Random) {
    const tab = (await tableView(tableId)).tab!;
    const remaining = d(tab.remaining);
    const amount = parts > 1 ? remaining.dividedBy(parts).toDecimalPlaces(2, Decimal.ROUND_DOWN) : remaining;
    let received: Decimal | null = null;
    if (method === "CASH") {
      const step = amount.gt(100) ? d(50) : d(10);
      received = rnd.chance(0.25) ? amount : amount.dividedBy(step).ceil().times(step);
      cashState.expected = cashState.expected.plus(amount);
    }
    must(
      await addPayment(deps, r.cashier, {
        tabId: tab.id,
        method,
        amount,
        received,
        clientRequestId: deps.ids.next(),
      }),
      "pagamento",
    );
  }

  async function closeTable(tableId: string) {
    const tabId = (await tableView(tableId)).tab!.id;
    const version = must(await getTab(deps, r.cashier, tabId), "conta").version;
    must(await closeTab(deps, r.cashier, { tabId, version }), "fechar a conta");
  }

  async function withdrawals(cash: { expected: Decimal }) {
    const expected = cash.expected.plus(cashState.expected);
    if (rnd.chance(0.3) && expected.gt(80)) {
      const amount = d(rnd.int(3, 9) * 5);
      must(
        await addCashEntry(deps, r.cashier, {
          kind: "WITHDRAWAL",
          amount,
          reason: "DAILY_EXPENSE",
          note: rnd.pick([
            "Gelo no mercado",
            "Pão para a cozinha",
            "Gás de cozinha (parte)",
            "Frete do hortifrúti",
          ]),
          clientRequestId: deps.ids.next(),
        }),
        "sangria de despesa",
      );
      cash.expected = cash.expected.minus(amount);
    }
    const now = cash.expected.plus(cashState.expected);
    if (now.gt(600)) {
      const amount = now.minus(300).dividedBy(50).floor().times(50);
      must(
        await addCashEntry(deps, r.cashier, {
          kind: "WITHDRAWAL",
          amount,
          reason: "SAFE",
          note: "Para o cofre",
          clientRequestId: deps.ids.next(),
        }),
        "sangria para o cofre",
      );
      cash.expected = cash.expected.minus(amount);
    }
  }

  /** Contagem cega: o caixa conta o que tem; às vezes falta ou sobra um troco. */
  async function closeCash(cash: { sessionId: string; expected: Decimal }) {
    const expected = cash.expected.plus(cashState.expected);
    cashState.expected = d(0);
    const roll = rnd.next();
    const difference =
      roll < 0.12
        ? d(-rnd.int(1, 10) * 50).dividedBy(100)
        : roll < 0.17
          ? d(rnd.int(1, 4) * 50).dividedBy(100)
          : d(0);
    const counted = expected.plus(difference);
    must(
      await countCash(deps, r.cashier, { sessionId: cash.sessionId, counted, denominations: null }),
      "contar o caixa",
    );
    must(
      await closeCashSession(deps, r.cashier, {
        sessionId: cash.sessionId,
        kept: counted.lt(OPENING_FLOAT) ? counted : OPENING_FLOAT,
        note: difference.isZero() ? null : difference.isNeg() ? "Faltou troco" : "Cliente deixou o troco",
      }),
      "fechar o caixa",
    );
  }

  // ---------------------------------------------------------------------------------------------
  // Estoque.

  async function buy(key: string, quantity: Decimal, fromSupplier: boolean) {
    const it = DEMO_ITEMS.find((x) => x.key === key)!;
    const pkg = fromSupplier && it.pkg ? d(it.pkg[1]) : null;
    const drift = d(100 + rnd.int(-3, 5)).dividedBy(100);
    const markup = fromSupplier ? d(1) : d("1.15");
    const unitCost = d(it.cost).times(drift).times(markup);
    const total = (pkg ? unitCost.times(pkg).times(quantity) : unitCost.times(quantity)).toDecimalPlaces(2);
    must(
      await registerPurchase(deps, r.stock, {
        itemId: r.items.get(key)!,
        supplierId: fromSupplier ? r.suppliers.get(it.supplier)! : null,
        quantity,
        unit: pkg ? "SUPPLIER_PACKAGE" : it.unit,
        totalPaid: total,
        occurredAt: clock.now(),
        notes: fromSupplier ? null : "Compra no mercado do bairro",
        idempotencyKey: null,
      }),
      `compra de ${it.description}`,
    );
  }

  /** Quantidade a comprar para chegar em `target`: embalagens inteiras do fornecedor ou inteiro na medida. */
  function toBuy(it: (typeof DEMO_ITEMS)[number], missing: Decimal, fromSupplier: boolean): Decimal {
    if (fromSupplier && it.pkg) return missing.dividedBy(it.pkg[1]).ceil();
    return missing.ceil();
  }

  async function openingPurchase() {
    for (const it of DEMO_ITEMS) await buy(it.key, toBuy(it, d(it.par), true), true);
  }

  async function restock(dow: number) {
    const now = await balances();
    for (const it of DEMO_ITEMS) {
      const supplier = DEMO_SUPPLIERS.find((s) => s.key === it.supplier)!;
      const delivers = supplier.deliveryDays.includes(dow);
      const balance = now.get(it.key)!;
      const used = usage.get(it.key) ?? d(0);
      if (delivers) {
        const cover = d(supplier.deliveryDays.length >= 3 ? 3 : 5);
        const target = Decimal.max(d(it.par), used.times(cover));
        const threshold = Decimal.max(d(it.point), used.times("2.5"));
        if (balance.lt(threshold)) await buy(it.key, toBuy(it, target.minus(balance), true), true);
      } else if (SCHEDULE[dow] && used.gt(0) && balance.lt(used.times("1.5"))) {
        await buy(it.key, toBuy(it, used.times(2).minus(balance), false), false);
      }
    }
  }

  async function loss(l: (typeof LOSSES)[number]) {
    const it = DEMO_ITEMS.find((x) => x.key === l.item)!;
    const balance = (await balances()).get(l.item)!;
    if (balance.lt(d(l.qty).times(3))) return;
    must(
      await registerLoss(deps, rnd.pick([r.chef, r.stock]), {
        itemId: r.items.get(l.item)!,
        quantity: d(l.qty),
        unit: it.unit,
        reasonId: reason("LOSS", l.code),
        occurredAt: clock.now(),
        notes: l.note,
        idempotencyKey: null,
      }),
      `perda de ${it.description}`,
    );
  }

  /** Segunda de manhã: o estoquista conta três itens e o dono aprova a diferença. */
  async function weeklyCount(week: number) {
    const now = await balances();
    for (let i = 0; i < 3; i++) {
      const key = COUNTED[(week * 3 + i) % COUNTED.length]!;
      const it = DEMO_ITEMS.find((x) => x.key === key)!;
      const balance = now.get(key)!;
      if (balance.lte(1)) continue;
      const factor = d(100 - rnd.int(1, 4)).dividedBy(100);
      const counted =
        it.unit === "un" ? balance.times(factor).floor() : balance.times(factor).toDecimalPlaces(3);
      if (counted.eq(balance)) continue;
      const req = must(
        await requestAdjustment(deps, r.stock, {
          itemId: r.items.get(key)!,
          countedQuantity: counted,
          unit: it.unit,
          reasonId: reason("ADJUSTMENT", "SHELF_CHECK"),
          notes: "Contagem semanal",
        }),
        `contagem de ${it.description}`,
      );
      clock.set(plus(clock.now(), 20));
      must(await decideAdjustment(deps, r.owner, req.requestId, true, null), "aprovar a contagem");
    }
  }
}

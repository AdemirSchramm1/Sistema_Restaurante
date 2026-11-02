import { describe, it, expect } from "vitest";
import { addMember, newRestaurant, ownerTestDb, subgroupId, testEnv, type TestEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { supplierData, supplierItemData } from "../../builders/supplier-data";
import { createItem } from "../../../src/application/inventory/create-item";
import { getItem } from "../../../src/application/inventory/get-item";
import { listItems } from "../../../src/application/inventory/list-items";
import { setItemActive } from "../../../src/application/inventory/set-item-active";
import {
  decideAdjustment,
  registerLoss,
  registerPurchase,
  requestAdjustment,
  reverseMovement,
} from "../../../src/application/inventory/movements";
import { addSupplierItem, createSupplier } from "../../../src/application/suppliers/suppliers";
import {
  countReorderAlerts,
  getReorderView,
  listReorderAlerts,
  setReorderLevels,
} from "../../../src/application/inventory/reorder";
import { stockReport } from "../../../src/application/inventory/stock-report";
import { getAuditHistory } from "../../../src/application/audit/get-audit-history";
import type { RequestContext } from "../../../src/application/context";
import { reasonByCode } from "../../../src/domain/inventory/movement-reasons";
import { d } from "../../../src/domain/shared/decimal";

const BURNT = reasonByCode("LOSS", "BURNT")!.id;
const EXPIRED = reasonByCode("LOSS", "EXPIRED")!.id;
const SHELF = reasonByCode("ADJUSTMENT", "SHELF_CHECK")!.id;
const WRONG = reasonByCode("REVERSAL", "WRONG_ENTRY")!.id;
const DAY = 24 * 60 * 60 * 1000;

const unwrap = <T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
};
const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "OK" : r.error!.code);
const s = (v: { toString(): string } | null | undefined) => (v == null ? null : v.toString());

let keySeq = 0;
const key = () => `r-${Date.now()}-${++keySeq}`;

async function item(env: TestEnv, ctx: RequestContext, description: string, unit: "kg" | "un" = "kg") {
  const sub = await subgroupId(env, ctx, "01", "02");
  const data =
    unit === "kg"
      ? itemData({ subgroupId: sub, description })
      : itemData({ subgroupId: sub, description, stockUnit: "un", purchaseUnitLabel: null, purchaseFactor: null });
  return unwrap(await createItem(env.deps, ctx, data)).id;
}

const buy = (env: TestEnv, ctx: RequestContext, itemId: string, kg: string, total: string, daysAgo = 0) =>
  registerPurchase(env.deps, ctx, {
    itemId,
    quantity: d(kg),
    unit: "kg",
    totalPaid: d(total),
    occurredAt: new Date(env.clock.now().getTime() - daysAgo * DAY),
    notes: null,
    idempotencyKey: key(),
  });

const lose = (env: TestEnv, ctx: RequestContext, itemId: string, kg: string, reasonId = BURNT, daysAgo = 0) =>
  registerLoss(env.deps, ctx, {
    itemId,
    quantity: d(kg),
    unit: "kg",
    reasonId,
    occurredAt: new Date(env.clock.now().getTime() - daysAgo * DAY),
    notes: null,
    idempotencyKey: key(),
  });

const levels = (reorderPoint: string | null, parLevel: string | null) => ({
  reorderPoint: reorderPoint === null ? null : d(reorderPoint),
  parLevel: parLevel === null ? null : d(parLevel),
});

const version = async (env: TestEnv, ctx: RequestContext, id: string) =>
  unwrap(await getItem(env.deps, ctx, id)).item.version;

describe("aviso do item (spec 006, US1)", () => {
  it("salva o ponto e o comprar até, mostra no item e registra na auditoria", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const id = await item(env, ctx, "Tomate italiano");
    unwrap(await setReorderLevels(env.deps, ctx, id, 1, levels("20", "50")));

    const v = unwrap(await getItem(env.deps, ctx, id));
    expect(s(v.item.reorderPoint)).toBe("20");
    expect(s(v.item.parLevel)).toBe("50");
    expect(v.item.version).toBe(2);

    const history = unwrap(await getAuditHistory(env.deps, ctx, "item", id));
    expect(history.some((h) => JSON.stringify(h.changes).includes("reorderPoint"))).toBe(true);
  });

  it("deixar o ponto em branco desliga o aviso", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const id = await item(env, ctx, "Tomate italiano");
    unwrap(await setReorderLevels(env.deps, ctx, id, 1, levels("20", null)));
    unwrap(await setReorderLevels(env.deps, ctx, id, 2, levels(null, null)));
    expect(unwrap(await getItem(env.deps, ctx, id)).item.reorderPoint).toBeNull();
  });

  it("recusa comprar até menor que o ponto, versão velha e quem não pode", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const id = await item(env, ctx, "Tomate italiano");
    expect(code(await setReorderLevels(env.deps, ctx, id, 1, levels("20", "10")))).toBe("INVALID_REORDER_LEVELS");
    unwrap(await setReorderLevels(env.deps, ctx, id, 1, levels("20", null)));
    expect(code(await setReorderLevels(env.deps, ctx, id, 1, levels("5", null)))).toBe("STALE_RECORD");

    const stockkeeper = await addMember(env, ctx, ["STOCKKEEPER"]);
    expect(code(await setReorderLevels(env.deps, stockkeeper, id, 2, levels("5", null)))).toBe("FORBIDDEN");
    const buyer = await addMember(env, ctx, ["BUYER"]);
    expect(code(await setReorderLevels(env.deps, buyer, id, 2, levels("5", null)))).toBe("OK");
  });

  it("o banco também recusa comprar até sem ponto ou menor que ele", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const id = await item(env, ctx, "Tomate italiano");
    const db = ownerTestDb().$client;
    await expect(db.query("update items set par_level = 10 where id = $1", [id])).rejects.toThrow();
    await expect(
      db.query("update items set reorder_point = 10, par_level = 10 where id = $1", [id]),
    ).rejects.toThrow();
    await expect(db.query("update items set reorder_point = -1 where id = $1", [id])).rejects.toThrow();
  });
});

/** Tomate: 60 kg comprados, aviso em 20, comprar até 50; Hortifruti preferido, caixa de 18 kg, entrega em 1 dia, seg e qui. */
async function scenario(env: TestEnv, ctx: RequestContext) {
  const tomato = await item(env, ctx, "Tomate italiano");
  unwrap(await buy(env, ctx, tomato, "60", "240"));
  unwrap(await setReorderLevels(env.deps, ctx, tomato, await version(env, ctx, tomato), levels("20", "50")));
  const supplier = unwrap(
    await createSupplier(
      env.deps,
      ctx,
      supplierData({ phone: "(11) 99999-0000", leadTimeDays: 1, deliveryDays: [1, 4] }),
    ),
  ).id;
  unwrap(await addSupplierItem(env.deps, ctx, supplier, supplierItemData(tomato, { preferred: true })));
  return { tomato, supplier };
}

describe("lista Repor (spec 006, US2)", () => {
  it("item que chegou no ponto aparece com quanto comprar na caixa do fornecedor preferido", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const { tomato } = await scenario(env, ctx);
    expect(unwrap(await listReorderAlerts(env.deps, ctx))).toEqual([]);
    expect(unwrap(await countReorderAlerts(env.deps, ctx))).toBe(0);

    unwrap(await lose(env, ctx, tomato, "45"));
    const rows = unwrap(await listReorderAlerts(env.deps, ctx));
    expect(rows).toHaveLength(1);
    const r = rows[0]!;
    expect(r.itemId).toBe(tomato);
    expect(s(r.balance)).toBe("15");
    expect(s(r.reorderPoint)).toBe("20");
    // CMD = 45 ÷ 30 = 1,5; pedir = 50 − (15 − 1,5 × 1) = 36,5 → 3 caixas de 18 kg (54 kg)
    expect(s(r.averageDailyUsage)).toBe("1.5");
    expect(s(r.order.quantity)).toBe("36.5");
    expect(r.order.packages).toEqual({ count: d(3), label: "Caixa", total: d(54) });
    expect(r.supplier).toEqual({ name: "Hortifruti do João", phone: "(11) 99999-0000", leadTimeDays: 1 });
    expect(unwrap(await countReorderAlerts(env.deps, ctx))).toBe(1);
  });

  it("sem fornecedor usa a embalagem do item; sem comprar até não calcula; acabou vem primeiro", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const onion = await item(env, ctx, "Cebola");
    unwrap(await buy(env, ctx, onion, "10", "50"));
    unwrap(await setReorderLevels(env.deps, ctx, onion, await version(env, ctx, onion), levels("12", "30")));
    const garlic = await item(env, ctx, "Alho");
    unwrap(await setReorderLevels(env.deps, ctx, garlic, 1, levels("1", null)));

    const rows = unwrap(await listReorderAlerts(env.deps, ctx));
    expect(rows.map((r) => r.name)).toEqual(["Alho", "Cebola"]);
    expect(rows[0]!.order.quantity).toBeNull();
    // Cebola: 30 − 10 = 20 kg → 1 caixa de 20 kg
    expect(s(rows[1]!.order.quantity)).toBe("20");
    expect(rows[1]!.order.packages).toEqual({ count: d(1), label: "Caixa", total: d(20) });
    expect(rows[1]!.supplier).toBeNull();
  });

  it("item inativo não avisa e a lista de itens marca quem está no ponto", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const onion = await item(env, ctx, "Cebola");
    unwrap(await setReorderLevels(env.deps, ctx, onion, 1, levels("5", null)));
    const list = unwrap(await listItems(env.deps, ctx, { page: 1 }));
    expect(list.rows[0]!.atReorderPoint).toBe(true);

    unwrap(await setItemActive(env.deps, ctx, onion, 2, false));
    expect(unwrap(await listReorderAlerts(env.deps, ctx))).toEqual([]);
    expect(unwrap(await countReorderAlerts(env.deps, ctx))).toBe(0);
  });

  it("outro restaurante não vê o aviso", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const onion = await item(env, ctx, "Cebola");
    unwrap(await setReorderLevels(env.deps, ctx, onion, 1, levels("5", null)));
    const other = await newRestaurant(env, "Outro");
    expect(unwrap(await listReorderAlerts(env.deps, other))).toEqual([]);
    expect(unwrap(await countReorderAlerts(env.deps, other))).toBe(0);
  });
});

describe("sugestão no item (spec 006, FR-005)", () => {
  it("45 kg em 30 dias, entrega em 1 dia, seg e qui: PP 2,55 e comprar até 6,3", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const { tomato } = await scenario(env, ctx);
    expect(unwrap(await getReorderView(env.deps, ctx, tomato)).suggestion).toBeNull();

    unwrap(await lose(env, ctx, tomato, "45"));
    const v = unwrap(await getReorderView(env.deps, ctx, tomato));
    expect(v.atReorderPoint).toBe(true);
    expect(s(v.suggestion!.averageDailyUsage)).toBe("1.5");
    // ES = 1,5 × 3,5 × 0,2 = 1,05; PP = 1,5 + 1,05; Par = 5,25 + 1,05
    expect(s(v.suggestion!.reorderPoint)).toBe("2.55");
    expect(s(v.suggestion!.parLevel)).toBe("6.3");
    expect(v.suggestion!.leadTimeDays).toBe(1);
    expect(s(v.suggestion!.cycleDays)).toBe("3.5");
  });

  it("saída de mais de 30 dias atrás não entra no consumo", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const { tomato } = await scenario(env, ctx);
    unwrap(await lose(env, ctx, tomato, "10", BURNT, 31));
    expect(unwrap(await getReorderView(env.deps, ctx, tomato)).suggestion).toBeNull();
  });
});

describe("gráficos do estoque (spec 006, US3)", () => {
  it("mais saíram, menos saíram (com parado), motivos, resumo e semanas", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const tomato = await item(env, ctx, "Tomate italiano");
    const onion = await item(env, ctx, "Cebola");
    const rice = await item(env, ctx, "Arroz");
    unwrap(await buy(env, ctx, tomato, "20", "80", 3));
    unwrap(await buy(env, ctx, onion, "10", "50", 3));
    unwrap(await buy(env, ctx, rice, "5", "30", 3));
    unwrap(await lose(env, ctx, tomato, "10", BURNT, 1)); // R$ 40
    unwrap(await lose(env, ctx, onion, "1", EXPIRED, 1)); // R$ 5

    const r = unwrap(await stockReport(env.deps, ctx, "30"));
    expect(r.period.days).toBe(30);
    expect(r.most.map((x) => [x.name, s(x.quantity), s(x.value)])).toEqual([
      ["Tomate italiano", "10", "40"],
      ["Cebola", "1", "5"],
    ]);
    expect(r.least.map((x) => [x.name, x.stopped])).toEqual([
      ["Arroz", true],
      ["Cebola", false],
      ["Tomate italiano", false],
    ]);
    expect(r.byReason.map((x) => [x.label, s(x.value)])).toEqual([
      ["Queimou", "40"],
      ["Venceu", "5"],
    ]);
    expect(s(r.summary.inflow)).toBe("160");
    expect(s(r.summary.outflow)).toBe("45");
    expect(s(r.summary.losses)).toBe("45");
    expect(r.summary.reorderCount).toBe(0);
    const weekIn = r.weeks.reduce((a, w) => a.add(w.inflow), d(0));
    const weekOut = r.weeks.reduce((a, w) => a.add(w.outflow), d(0));
    expect(s(weekIn)).toBe("160");
    expect(s(weekOut)).toBe("45");
    expect(r.weeks.length).toBeGreaterThanOrEqual(5);
  });

  it("estorno e lançamento estornado não contam; acerto para menos conta como saída", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const other = await addMember(env, ctx, ["MANAGER"], "Outro gerente");
    const tomato = await item(env, ctx, "Tomate italiano");
    unwrap(await buy(env, ctx, tomato, "20", "80"));
    const wrongBuy = unwrap(await buy(env, ctx, tomato, "5", "20")).movementId;
    unwrap(await reverseMovement(env.deps, ctx, wrongBuy, { reasonId: WRONG, notes: null, idempotencyKey: key() }));
    const wrongLoss = unwrap(await lose(env, ctx, tomato, "3")).movementId;
    unwrap(await reverseMovement(env.deps, ctx, wrongLoss, { reasonId: WRONG, notes: null, idempotencyKey: key() }));
    const req = unwrap(
      await requestAdjustment(env.deps, ctx, {
        itemId: tomato,
        countedQuantity: d(18),
        unit: "kg",
        reasonId: SHELF,
        notes: null,
      }),
    );
    unwrap(await decideAdjustment(env.deps, other, req.requestId, true, null));

    const r = unwrap(await stockReport(env.deps, ctx, "7"));
    expect(s(r.summary.inflow)).toBe("80");
    expect(s(r.summary.outflow)).toBe("8");
    expect(s(r.summary.losses)).toBe("0");
    expect(r.most.map((x) => [x.name, s(x.quantity)])).toEqual([["Tomate italiano", "2"]]);
    expect(r.byReason.map((x) => x.label)).toEqual(["Conferi na prateleira"]);
  });

  it("o período escolhido limita as contas pela data do fato", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const tomato = await item(env, ctx, "Tomate italiano");
    unwrap(await buy(env, ctx, tomato, "20", "80", 60));
    unwrap(await lose(env, ctx, tomato, "10", BURNT, 40));

    const r30 = unwrap(await stockReport(env.deps, ctx, "30"));
    expect(r30.most).toEqual([]);
    expect(s(r30.summary.inflow)).toBe("0");
    expect(r30.least.map((x) => [x.name, x.stopped])).toEqual([["Tomate italiano", true]]);

    const r90 = unwrap(await stockReport(env.deps, ctx, "90"));
    expect(r90.most.map((x) => x.name)).toEqual(["Tomate italiano"]);
    expect(s(r90.summary.inflow)).toBe("80");
  });

  it("outro restaurante não vê nada", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const tomato = await item(env, ctx, "Tomate italiano");
    unwrap(await buy(env, ctx, tomato, "20", "80"));
    unwrap(await lose(env, ctx, tomato, "10"));
    const other = await newRestaurant(env, "Outro");
    const r = unwrap(await stockReport(env.deps, other, "30"));
    expect(r.most).toEqual([]);
    expect(r.least).toEqual([]);
    expect(s(r.summary.inflow)).toBe("0");
  });
});

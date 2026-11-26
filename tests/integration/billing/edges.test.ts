import { describe, it, expect } from "vitest";
import { addMember, newRestaurant, ownerTestDb, testEnv, type TestEnv } from "../harness";
import { code, orderingScenario, tableWithQr, unwrap } from "../ordering/fixtures";
import { billingScenario } from "./fixtures";
import { addPayment, removePayment } from "../../../src/application/billing/payments";
import {
  closeTab,
  getTab,
  listTabs,
  reopenTab,
  setServiceWaived,
} from "../../../src/application/billing/tabs";
import { getServiceChargeSettings, setServiceChargeRate } from "../../../src/application/billing/settings";
import { closeCashSession, countCash } from "../../../src/application/cash/closing";
import { cancelOrder } from "../../../src/application/ordering/kitchen";
import type { Repos } from "../../../src/application/ports";
import type { RequestContext } from "../../../src/application/context";
import { d } from "../../../src/domain/shared/decimal";
import { ok } from "../../../src/domain/shared/result";

/** Spec 018, US1: as recusas e os casos raros da conta da mesa que ainda não tinham teste. */

const db = () => ownerTestDb().$client;
const inRepos = async <T>(env: TestEnv, ctx: RequestContext, fn: (repos: Repos) => Promise<T>): Promise<T> =>
  unwrap(await env.deps.tenant(ctx.restaurantId, async (repos) => ok(await fn(repos))));

/** Mesa 12 com um Suco (R$ 9,90 com a taxa) e o caixa do dia aberto. */
async function setup(env: TestEnv) {
  const b = await billingScenario(env);
  await b.s.place([b.s.juice()]);
  const id = await b.tabId();
  const version = async () => unwrap(await getTab(env.deps, b.cashier, id)).version;
  return { ...b, id, version };
}

/** Mesa 12 com um Suco, mas o caixa do dia nunca foi aberto. */
async function withoutCash(env: TestEnv) {
  const m = await newRestaurant(env, "Restaurante Sem Caixa");
  const s = await orderingScenario(env, m);
  const cashier = await addMember(env, m, ["CASHIER"], "Caixa Carla");
  const chef = await addMember(env, m, ["CHEF"], "Chef Ana");
  const order = await s.place([s.juice()]);
  const tab = await db().query("select id from table_tabs where table_id = $1", [s.table.tableId]);
  return { m, s, cashier, chef, order, id: tab.rows[0].id as string };
}

const pix = (tabId: string, clientRequestId: string = crypto.randomUUID()) => ({
  tabId,
  method: "PIX" as const,
  amount: d("5.00"),
  received: null,
  clientRequestId,
});

describe("pagamento: recusas antes de gravar (spec 011, US2; spec 014, FR-002)", () => {
  it("id do pedido de pagamento malformado é VALIDATION no campo clientRequestId", async () => {
    const env = testEnv();
    const t = await setup(env);
    const r = await addPayment(env.deps, t.cashier, pix(t.id, "toque-1"));
    expect(r.ok ? null : [r.error.code, r.error.field]).toEqual(["VALIDATION", "clientRequestId"]);
  });

  it("sem caixa aberto, não lança pagamento", async () => {
    const env = testEnv();
    const t = await withoutCash(env);
    expect(code(await addPayment(env.deps, t.cashier, pix(t.id)))).toBe("CASH_SESSION_REQUIRED");
  });

  it("tirar: ids malformados e conta que não existe são NOT_FOUND; garçom não tira", async () => {
    const env = testEnv();
    const t = await setup(env);
    const { paymentId } = unwrap(await addPayment(env.deps, t.cashier, pix(t.id)));
    expect(code(await removePayment(env.deps, t.cashier, { tabId: "x", paymentId }))).toBe("NOT_FOUND");
    expect(code(await removePayment(env.deps, t.cashier, { tabId: t.id, paymentId: "x" }))).toBe("NOT_FOUND");
    expect(code(await removePayment(env.deps, t.cashier, { tabId: crypto.randomUUID(), paymentId }))).toBe(
      "NOT_FOUND",
    );
    expect(code(await removePayment(env.deps, t.waiter, { tabId: t.id, paymentId }))).toBe("FORBIDDEN");
    expect(unwrap(await getTab(env.deps, t.cashier, t.id)).payments.map((p) => p.removedAt)).toEqual([null]);
  });

  it("tirar com o caixa já fechado é recusado e diz que a ação era tirar", async () => {
    const env = testEnv();
    const t = await setup(env);
    const { paymentId } = unwrap(await addPayment(env.deps, t.cashier, pix(t.id)));
    unwrap(
      await countCash(env.deps, t.cashier, {
        sessionId: t.cashSessionId,
        counted: d("0.00"),
        denominations: null,
      }),
    );
    unwrap(
      await closeCashSession(env.deps, t.cashier, { sessionId: t.cashSessionId, kept: null, note: null }),
    );
    const r = await removePayment(env.deps, t.cashier, { tabId: t.id, paymentId });
    expect(r.ok ? null : [r.error.code, r.error.details]).toEqual([
      "CASH_SESSION_REQUIRED",
      { action: "remove" },
    ]);
  });
});

describe("conta: recusas e casos raros (spec 011, US1, US2 e US6)", () => {
  it("id malformado ou conta que não existe: NOT_FOUND em ver, taxa, fechar e reabrir", async () => {
    const env = testEnv();
    const t = await setup(env);
    const missing = crypto.randomUUID();
    expect(code(await getTab(env.deps, t.cashier, "x"))).toBe("NOT_FOUND");
    for (const tabId of ["x", missing]) {
      expect(code(await setServiceWaived(env.deps, t.cashier, { tabId, waived: true, version: 1 }))).toBe(
        "NOT_FOUND",
      );
      expect(code(await closeTab(env.deps, t.cashier, { tabId, version: 1 }))).toBe("NOT_FOUND");
      expect(code(await reopenTab(env.deps, t.m, { tabId, reason: "Cobrou errado", version: 1 }))).toBe(
        "NOT_FOUND",
      );
    }
  });

  it("tirar a taxa que já está tirada não muda nada", async () => {
    const env = testEnv();
    const t = await setup(env);
    unwrap(
      await setServiceWaived(env.deps, t.cashier, { tabId: t.id, waived: true, version: await t.version() }),
    );
    const v = await t.version();
    unwrap(await setServiceWaived(env.deps, t.cashier, { tabId: t.id, waived: true, version: v }));
    const tab = unwrap(await getTab(env.deps, t.cashier, t.id));
    expect([tab.version, tab.events.filter((e) => e.kind === "SERVICE_WAIVED").length]).toEqual([v, 1]);
  });

  it("conta de R$ 0,00 fecha sem caixa aberto e não guarda turno", async () => {
    const env = testEnv();
    const t = await withoutCash(env);
    unwrap(
      await cancelOrder(env.deps, t.chef, {
        id: t.order.orderId,
        reason: "CUSTOMER_GAVE_UP",
        note: null,
        version: 1,
      }),
    );
    const version = unwrap(await getTab(env.deps, t.cashier, t.id)).version;
    unwrap(await closeTab(env.deps, t.cashier, { tabId: t.id, version }));
    const row = await db().query("select status, cash_session_id from table_tabs where id = $1", [t.id]);
    expect(row.rows[0]).toEqual({ status: "CLOSED", cash_session_id: null });
  });

  it("contas fechadas: mesa com id malformado é VALIDATION no campo tableId", async () => {
    const env = testEnv();
    const t = await setup(env);
    const r = await listTabs(env.deps, t.cashier, {
      from: "2026-11-01",
      to: "2026-11-01",
      tableId: "mesa-12",
    });
    expect(r.ok ? null : [r.error.code, r.error.field]).toEqual(["VALIDATION", "tableId"]);
  });

  it("desligar a taxa (nula) e ligar de novo ficam na auditoria com o nulo", async () => {
    const env = testEnv();
    const t = await setup(env);
    const { version } = unwrap(await getServiceChargeSettings(env.deps, t.m));
    unwrap(await setServiceChargeRate(env.deps, t.m, { rate: null, version }));
    expect(unwrap(await getServiceChargeSettings(env.deps, t.m)).rate).toBeNull();
    const again = unwrap(await getServiceChargeSettings(env.deps, t.m)).version;
    unwrap(await setServiceChargeRate(env.deps, t.m, { rate: d("12"), version: again }));
    const audit = await db().query(
      "select changes from audit_log where entity = 'restaurant' and entity_id = $1 and action = 'UPDATE'",
      [t.m.restaurantId],
    );
    expect(audit.rows.map((r) => r.changes)).toEqual(
      expect.arrayContaining([
        { serviceChargeRate: ["10.00", null] },
        { serviceChargeRate: [null, "12.00"] },
      ]),
    );
  });
});

describe("repositório da conta (spec 011, data-model.md)", () => {
  it("abrir de novo a conta da mesa devolve a mesma, soma 1 na versão e não abre outra", async () => {
    const env = testEnv();
    const t = await setup(env);
    const before = await t.version();
    const again = await inRepos(env, t.m, (repos) =>
      repos.tabs.openForOrder(t.s.table.tableId, env.clock.now(), null),
    );
    expect(again).toEqual({ id: t.id, opened: false });
    expect(await t.version()).toBe(before + 1);
    const open = await db().query("select count(*)::int as n from table_tabs where table_id = $1", [
      t.s.table.tableId,
    ]);
    expect(open.rows[0].n).toBe(1);
  });

  it("conta aberta ainda sem pedido aparece entre as abertas, sem pedidos, e conta no total de abertas", async () => {
    const env = testEnv();
    const t = await setup(env);
    const { tableId } = await tableWithQr(env, t.m, "30");
    const opened = await inRepos(env, t.m, (repos) =>
      repos.tabs.openForOrder(tableId, env.clock.now(), d("10")),
    );
    expect(opened.opened).toBe(true);
    const rows = await inRepos(env, t.m, (repos) => repos.tabs.listOpen());
    expect(rows.find((r) => r.id === opened.id)?.orders).toEqual([]);
    expect(await inRepos(env, t.m, (repos) => repos.tabs.countOpen())).toBe(2);
  });

  it("reabrir com id que não é uuid é erro do banco, não recusa de negócio", async () => {
    const env = testEnv();
    const t = await setup(env);
    await expect(
      env.deps.tenant(t.m.restaurantId, async (repos) =>
        repos.tabs.reopen("nao-e-uuid", { at: env.clock.now(), by: t.m.userId }),
      ),
    ).rejects.toThrow();
  });

  it("restaurante que não existe não tem configuração da taxa", async () => {
    const env = testEnv();
    await expect(
      env.deps.tenant(crypto.randomUUID(), async (repos) => ok(await repos.billingSettings.get())),
    ).rejects.toThrow("restaurante não encontrado");
  });
});

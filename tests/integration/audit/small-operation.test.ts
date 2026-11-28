import { beforeEach, describe, expect, it } from "vitest";
import { addMember, newRestaurant, ownerTestDb, subgroupId, testEnv, type TestEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { createItem } from "../../../src/application/inventory/create-item";
import {
  decideAdjustment,
  listAdjustmentRequests,
  listMovements,
  movementItemOptions,
  registerPurchase,
  requestAdjustment,
} from "../../../src/application/inventory/movements";
import { getSmallOperation, setSmallOperation } from "../../../src/application/audit/small-operation";
import { searchAudit } from "../../../src/application/audit/search-audit";
import type { RequestContext } from "../../../src/application/context";
import { reasonByCode } from "../../../src/domain/inventory/movement-reasons";
import { d } from "../../../src/domain/shared/decimal";
import type { Result } from "../../../src/domain/shared/result";

const SHELF = reasonByCode("ADJUSTMENT", "SHELF_CHECK")!.id;
const code = (r: Result<unknown>) => (r.ok ? "OK" : r.error.code);
const value = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
};

/** Spec 019, US2: o gerente único aprova o próprio acerto, marcado como exceção. */
describe("modo operação pequena (spec 019, US2)", () => {
  let env: TestEnv;
  let m: RequestContext;
  let tomato: string;

  const ask = async (who: RequestContext, counted = 8) =>
    value(
      await requestAdjustment(env.deps, who, {
        itemId: tomato,
        countedQuantity: d(counted),
        unit: "kg",
        reasonId: SHELF,
        notes: null,
      }),
    ).requestId;
  const turn = async (enabled: boolean, who = m) => {
    const { version } = value(await getSmallOperation(env.deps, m));
    return setSmallOperation(env.deps, who, { enabled, version });
  };
  const balance = async () =>
    value(await movementItemOptions(env.deps, m))
      .find((i) => i.id === tomato)!
      .balance.toString();
  const auditOf = async (requestId: string) =>
    value(await searchAudit(env.deps, m, { tipo: "STOCK" }))
      .rows.filter((r) => r.entityId === requestId)
      .map((r) => r.changes);

  beforeEach(async () => {
    env = testEnv();
    m = await newRestaurant(env);
    const sub = await subgroupId(env, m, "01", "02");
    tomato = value(await createItem(env.deps, m, itemData({ subgroupId: sub }))).id;
    value(
      await registerPurchase(env.deps, m, {
        itemId: tomato,
        quantity: d(10),
        unit: "kg",
        totalPaid: d(30),
        occurredAt: env.clock.now(),
        notes: null,
        idempotencyKey: null,
      }),
    );
  });

  it("vem desligado; ligar e desligar só o gerente, com versão e trilha", async () => {
    const chef = await addMember(env, m, ["CHEF"], "Chef Bia");
    const start = value(await getSmallOperation(env.deps, m));
    expect(start.enabled).toBe(false);
    expect(code(await getSmallOperation(env.deps, chef))).toBe("FORBIDDEN");
    expect(code(await setSmallOperation(env.deps, chef, { enabled: true, version: start.version }))).toBe(
      "FORBIDDEN",
    );

    value(await setSmallOperation(env.deps, m, { enabled: true, version: start.version }));
    // A outra tela ainda tem a versão antiga.
    expect(code(await setSmallOperation(env.deps, m, { enabled: false, version: start.version }))).toBe(
      "STALE_RECORD",
    );
    expect(value(await getSmallOperation(env.deps, m))).toEqual({
      enabled: true,
      version: start.version + 1,
    });
    // Mandar o mesmo valor não grava nada de novo.
    value(await turn(true));
    value(await turn(false));

    const trail = value(await searchAudit(env.deps, m, { tipo: "SETTINGS" })).rows;
    expect(
      trail.filter((r) => r.action !== "CREATE").map((r) => [r.entityId, r.action, r.userName, r.changes]),
    ).toEqual([
      [m.restaurantId, "UPDATE", "Gerente", { smallOperation: [true, false] }],
      [m.restaurantId, "UPDATE", "Gerente", { smallOperation: [false, true] }],
      [m.restaurantId, "DENIED", "Chef Bia", { action: "restaurant.small_operation" }],
      [m.restaurantId, "DENIED", "Chef Bia", { action: "restaurant.small_operation" }],
    ]);
  });

  it("desligado: quem pediu não aprova nem recusa, nem sendo gerente", async () => {
    const own = await ask(m);
    expect(code(await decideAdjustment(env.deps, m, own, true, null))).toBe("SELF_APPROVAL");
    expect(code(await decideAdjustment(env.deps, m, own, false, null))).toBe("SELF_APPROVAL");
  });

  it("ligado: o gerente aprova o próprio acerto, o saldo muda e fica a marca da exceção", async () => {
    value(await turn(true));
    const own = await ask(m);
    const done = value(await decideAdjustment(env.deps, m, own, true, null));
    expect(done.movementId).not.toBeNull();
    expect(await balance()).toBe("8");

    const [req] = value(await listAdjustmentRequests(env.deps, m, { status: "APPROVED" }));
    expect(req).toMatchObject({ id: own, status: "APPROVED", decidedBy: m.userId, selfDecided: true });
    const [mv] = value(await listMovements(env.deps, m, { type: "ADJUSTMENT" }));
    expect(mv).toMatchObject({ recordedBy: m.userId, approvedBy: m.userId });
    expect(await auditOf(own)).toEqual([
      { status: ["PENDING", "APPROVED"], selfApproved: [false, true] },
      { itemId: tomato, difference: "-2" },
    ]);
  });

  it("ligado: recusar o próprio pedido pode e não é exceção (o saldo não muda)", async () => {
    value(await turn(true));
    const own = await ask(m);
    value(await decideAdjustment(env.deps, m, own, false, null));
    expect(await balance()).toBe("10");
    const [req] = value(await listAdjustmentRequests(env.deps, m, { status: "REJECTED" }));
    expect(req).toMatchObject({ id: own, selfDecided: true });
    expect((await auditOf(own))[0]).toEqual({ status: ["PENDING", "REJECTED"] });
  });

  it("ligado: só o gerente aprova; outro gerente aprova sem exceção", async () => {
    value(await turn(true));
    const chef = await addMember(env, m, ["CHEF"], "Chef Bia");
    const fromChef = await ask(chef);
    expect(code(await decideAdjustment(env.deps, chef, fromChef, true, null))).toBe("FORBIDDEN");
    value(await decideAdjustment(env.deps, m, fromChef, true, null));
    const [req] = value(await listAdjustmentRequests(env.deps, m, { status: "APPROVED" }));
    expect(req).toMatchObject({ id: fromChef, selfDecided: false });
    expect((await auditOf(fromChef))[0]).toEqual({ status: ["PENDING", "APPROVED"] });
  });

  it("desligar não desfaz a exceção; o pedido pendente volta a precisar de outro gerente", async () => {
    value(await turn(true));
    const first = await ask(m, 9);
    value(await decideAdjustment(env.deps, m, first, true, null));
    const second = await ask(m, 7);
    value(await turn(false));
    expect(code(await decideAdjustment(env.deps, m, second, true, null))).toBe("SELF_APPROVAL");
    const [req] = value(await listAdjustmentRequests(env.deps, m, { status: "APPROVED" }));
    expect(req).toMatchObject({ id: first, selfDecided: true });
    expect(await balance()).toBe("9");
  });

  it("o banco recusa decisão de quem pediu sem a marca, e marca fora da decisão de quem pediu", async () => {
    value(await turn(true));
    const own = await ask(m);
    const db = ownerTestDb().$client;
    await expect(
      db.query(
        "update adjustment_requests set decided_by = created_by, decided_at = now(), status = 'APPROVED' where id = $1",
        [own],
      ),
    ).rejects.toThrow(/adjustment_requests_other_decider/);
    await expect(
      db.query("update adjustment_requests set self_decided = true where id = $1", [own]),
    ).rejects.toThrow(/adjustment_requests_self_decided/);
    await expect(
      db.query(
        "update adjustment_requests set decided_by = created_by, decided_at = now(), status = 'CANCELLED', self_decided = true where id = $1",
        [own],
      ),
    ).rejects.toThrow(/adjustment_requests_self_decided/);
  });
});

import { describe, it, expect } from "vitest";
import { addMember, newRestaurant, ownerTestDb, testEnv } from "../harness";
import { code, unwrap } from "./fixtures";
import {
  createTable,
  createTablesInRange,
  renameTable,
  rotateTableQr,
  setTableActive,
  tableQrCodes,
} from "../../../src/application/ordering/tables";

/** Spec 018, US3: recusas e casos das mesas (docs/produto/pedidos/01) que faltavam. */

const MISSING = "00000000-0000-4000-8000-000000000000";
const auditOf = async (id: string) =>
  (
    await ownerTestDb().$client.query(
      "select action from audit_log where entity = 'dining_table' and entity_id = $1 and action <> 'DENIED' order by occurred_at, id",
      [id],
    )
  ).rows.map((r) => r.action);

async function setup() {
  const env = testEnv();
  const m = await newRestaurant(env);
  const chef = await addMember(env, m, ["CHEF"]);
  const { id } = unwrap(await createTable(env.deps, m, { name: "Varanda" }));
  return { env, m, chef, id };
}

describe("mesas: recusas (spec 009, US1)", () => {
  it("quem não é gerente recebe FORBIDDEN em faixa, renomear, inativar e trocar QR code", async () => {
    const { env, chef, id } = await setup();
    expect(code(await createTablesInRange(env.deps, chef, { from: 1, to: 2 }))).toBe("FORBIDDEN");
    expect(code(await renameTable(env.deps, chef, { id, name: "X", version: 1 }))).toBe("FORBIDDEN");
    expect(code(await setTableActive(env.deps, chef, { id, active: false, version: 1 }))).toBe("FORBIDDEN");
    expect(code(await rotateTableQr(env.deps, chef, { id, version: 1 }))).toBe("FORBIDDEN");
  });

  it("nome vazio é INVALID_TABLE_NAME; mesa que não existe é NOT_FOUND; versão velha é STALE_RECORD", async () => {
    const { env, m, id } = await setup();
    expect(code(await renameTable(env.deps, m, { id, name: "  ", version: 1 }))).toBe("INVALID_TABLE_NAME");
    expect(code(await renameTable(env.deps, m, { id: MISSING, name: "X", version: 1 }))).toBe("NOT_FOUND");
    expect(code(await setTableActive(env.deps, m, { id: MISSING, active: false, version: 1 }))).toBe(
      "NOT_FOUND",
    );
    expect(code(await rotateTableQr(env.deps, m, { id: MISSING, version: 1 }))).toBe("NOT_FOUND");
    expect(code(await rotateTableQr(env.deps, m, { id, version: 9 }))).toBe("STALE_RECORD");
    expect(code(await setTableActive(env.deps, m, { id, active: false, version: 9 }))).toBe("STALE_RECORD");
  });

  it("renomear para o mesmo nome e inativar o que já está inativo não gravam auditoria", async () => {
    const { env, m, id } = await setup();
    unwrap(await renameTable(env.deps, m, { id, name: " Varanda ", version: 1 }));
    unwrap(await setTableActive(env.deps, m, { id, active: false, version: 2 }));
    unwrap(await setTableActive(env.deps, m, { id, active: false, version: 3 }));
    unwrap(await setTableActive(env.deps, m, { id, active: true, version: 4 }));
    expect(await auditOf(id)).toEqual(["CREATE", "DEACTIVATE", "REACTIVATE"]);
  });

  it("faixa pula a mesa ativa com o mesmo número, mas não a inativa", async () => {
    const { env, m } = await setup();
    const two = unwrap(await createTable(env.deps, m, { name: "2" })).id;
    const three = unwrap(await createTable(env.deps, m, { name: "3" })).id;
    unwrap(await setTableActive(env.deps, m, { id: three, active: false, version: 1 }));
    expect(unwrap(await createTablesInRange(env.deps, m, { from: 1, to: 3 }))).toEqual({
      created: 2,
      skipped: ["2"],
    });
    expect(await auditOf(two)).toEqual(["CREATE"]);
  });

  it("QR codes para imprimir saem em ordem natural", async () => {
    const { env, m } = await setup();
    unwrap(await createTablesInRange(env.deps, m, { from: 9, to: 10 }));
    const r = unwrap(await tableQrCodes(env.deps, m, {}));
    expect(r.tables.map((t) => t.name)).toEqual(["9", "10", "Varanda"]);
  });
});

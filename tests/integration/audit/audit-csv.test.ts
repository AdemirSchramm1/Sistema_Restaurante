import { describe, expect, it } from "vitest";
import { addMember, newRestaurant, testEnv, type TestEnv } from "../harness";
import { auditCsvResponse } from "../../../src/actions/_audit-csv";
import type { RequestContext } from "../../../src/application/context";
import type { AuditEntry } from "../../../src/application/ports";
import { ok } from "../../../src/domain/shared/result";

const url = (q: string) => new URL(`http://localhost:3000/equipe/auditoria/planilha?${q}`);

async function record(env: TestEnv, ctx: RequestContext, entry: Partial<AuditEntry>) {
  await env.deps.tenant(ctx.restaurantId, async (repos) => {
    await repos.audit.record({
      entity: "supplier",
      entityId: env.deps.ids.next(),
      action: "CREATE",
      changes: {},
      userId: ctx.userId,
      origin: { channel: "test" },
      ...entry,
    });
    return ok(undefined);
  });
}

async function body(res: Response) {
  const bytes = new Uint8Array(await res.arrayBuffer());
  expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes).slice(1).split("\r\n");
}

/** Planilha da auditoria (spec 019, US1-7 e FR-005). */
describe("GET /equipe/auditoria/planilha", () => {
  it("CSV com o filtro aplicado, todas as páginas, hora no fuso do restaurante e o que mudou", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const chef = await addMember(env, m, ["CHEF"], "Chef Bia");
    // 31/10 12:00 UTC = 09:00 em São Paulo.
    await record(env, chef, { entity: "item", action: "UPDATE", changes: { reorderPoint: ["2", "2.5"] } });
    env.clock.advance(60_000);
    await record(env, chef, { entity: "supplier", changes: { name: [null, "Hortifruti; Silva"] } });
    env.clock.advance(60_000);
    await record(env, chef, { entity: "cash_session", action: "DENIED", changes: { action: "cash.open" } });
    for (let i = 0; i < 55; i++) await record(env, m, { entity: "dining_table" });

    const res = await auditCsvResponse(env.deps, m, url(`de=2026-10-31&pessoa=${chef.userId}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="auditoria-2026-10-31-a-2026-10-31.csv"',
    );
    expect(await body(res)).toEqual([
      "Auditoria de 31/10/2026 a 31/10/2026",
      "",
      "Quando;Quem;Tipo;Registro;Ação;O que mudou",
      "31/10/2026 09:02:00;Chef Bia;Caixa do dia;;Tentou sem permissão;",
      '31/10/2026 09:01:00;Chef Bia;Fornecedores;"Hortifruti; Silva";Criou;',
      "31/10/2026 09:00:00;Chef Bia;Itens e grupos;;Alterou;Avisar quando chegar em: 2 → 2,5",
      "",
    ]);

    const all = await body(await auditCsvResponse(env.deps, m, url("tipo=TABLES")));
    expect(all.length).toBe(3 + 55 + 1);
  });

  it("só o gerente: 403; período inválido: 400; sem sessão: 401", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const chef = await addMember(env, m, ["CHEF"], "Chef Bia");
    expect((await auditCsvResponse(env.deps, chef, url(""))).status).toBe(403);
    expect((await auditCsvResponse(env.deps, m, url("de=2026-10-01&ate=2026-11-01"))).status).toBe(400);
    expect((await auditCsvResponse(env.deps, null, url(""))).status).toBe(401);
  });
});

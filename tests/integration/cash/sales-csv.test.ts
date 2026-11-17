import { describe, it, expect } from "vitest";
import { testEnv } from "../harness";
import { cashScenario } from "./fixtures";
import { salesCsvResponse } from "../../../src/actions/_sales-csv";

const DAY = "2026-10-31";
const url = (q: string) => new URL(`http://localhost:3000/vendas/planilha?${q}`);

/** Planilha para o contador (spec 014, US6-7). */
describe("GET /vendas/planilha", () => {
  it("CSV com BOM, `;` e as seções de formas, produtos e adicionais", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    await s.openSession();
    const order = await s.served("12", [s.burger(2), s.burger(1, 2), s.juice(2)]);
    await s.pay(order.tabId, "CASH", "112.00");
    const res = await salesCsvResponse(env.deps, s.m, url(`de=${DAY}&ate=${DAY}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe(`attachment; filename="vendas-${DAY}-a-${DAY}.csv"`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    // BOM: o Excel em português abre com os acentos certos.
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const body = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
    expect(body.slice(1).split("\r\n")).toEqual([
      "Vendas de 31/10/2026 a 31/10/2026",
      "",
      "Forma de pagamento;Valor (R$)",
      "Dinheiro;112,00",
      "Pix;0,00",
      "Cartão de débito;0,00",
      "Cartão de crédito;0,00",
      "Outro;0,00",
      "Total recebido;112,00",
      "Taxa de serviço;0,00",
      "",
      "Produto;Quantidade;Valor (R$);Parte (%)",
      "X-Burger;3;94,00;83,9",
      "Suco;2;18,00;16,1",
      "Total dos produtos;;112,00;",
      "",
      "Adicional;Vezes;Valor (R$)",
      "Fatia de queijo;2;4,00",
      "",
    ]);
  });

  it("sem permissão de vendas: 403; período inválido: 400; sem sessão: 401", async () => {
    const env = testEnv();
    const s = await cashScenario(env);
    expect((await salesCsvResponse(env.deps, s.ana, url(`de=${DAY}&ate=${DAY}`))).status).toBe(403);
    expect((await salesCsvResponse(env.deps, s.m, url("de=2026-10-01&ate=2026-11-01"))).status).toBe(400);
    expect((await salesCsvResponse(env.deps, s.m, url("de=x"))).status).toBe(400);
    expect((await salesCsvResponse(env.deps, null, url(`de=${DAY}&ate=${DAY}`))).status).toBe(401);
  });
});

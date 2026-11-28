import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  manualReasons,
  MOVEMENT_REASONS,
  REASON_FAMILY_LABELS,
  reasonByCode,
  reasonById,
} from "./movement-reasons";

/** Linhas `('id', 'TIPO', 'CODIGO', 'Nome', 'FAMILIA', posição)` do seed das migrações. */
function seed(...files: string[]) {
  const dir = path.resolve(import.meta.dirname, "../../infra/db/migrations");
  const row = /\('(0193a100-[^']+)', '(\w+)', '(\w+)', '([^']+)', '(\w+)', (\d+)\)/g;
  return files
    .flatMap((f) => [...readFileSync(path.join(dir, f), "utf8").matchAll(row)])
    .map((m) => ({ position: Number(m[6]), reason: [m[1], m[2], m[3], m[4], m[5]] }))
    .sort((a, b) => a.position - b.position)
    .map((x) => x.reason);
}

describe("motivos de movimentação (docs/produto/estoque/06-movimentacoes.md, spec 018)", () => {
  it("são os mesmos do banco, na mesma ordem: id, tipo, código, nome e família", () => {
    expect(MOVEMENT_REASONS.map((r) => [r.id, r.movementType, r.code, r.label, r.family])).toEqual(
      seed("0005_stock_ledger.sql", "0011_tabs.sql"),
    );
    expect(MOVEMENT_REASONS).toHaveLength(20);
  });

  it("só os dois 'Pedido cancelado' são do sistema", () => {
    expect(MOVEMENT_REASONS.filter((r) => r.system).map((r) => `${r.movementType} ${r.code}`)).toEqual([
      "LOSS ORDER_CANCELLED",
      "REVERSAL ORDER_CANCELLED",
    ]);
    expect(MOVEMENT_REASONS.filter((r) => !r.system).every((r) => !("system" in r))).toBe(true);
  });

  it("nomes das famílias na tela", () => {
    expect(REASON_FAMILY_LABELS).toEqual({
      PREP: "Perda de preparo",
      SPOILAGE: "Estragou",
      OPERATIONAL: "Erro na operação",
      ADJUSTMENT: "Acerto",
      REVERSAL: "Estorno",
    });
  });

  it("o formulário mostra os motivos do tipo, sem os do sistema", () => {
    expect(manualReasons("REVERSAL").map((r) => r.code)).toEqual(["WRONG_ENTRY", "DUPLICATE", "OTHER"]);
    expect(manualReasons("LOSS")).toHaveLength(11);
  });

  it("acha o motivo pelo id e pelo código", () => {
    const burnt = reasonByCode("LOSS", "BURNT")!;
    expect(reasonById(burnt.id)).toBe(burnt);
    expect(reasonById("0193a100-0000-7000-8000-000000000099")).toBeUndefined();
    expect(reasonByCode("ADJUSTMENT", "BURNT")).toBeUndefined();
  });
});

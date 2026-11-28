import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OPERATION_TYPES, OPERATION_TYPE_LABELS, entitiesOf, operationTypeOf } from "./operation-types";

/** Spec 019, FR-003: cada registro da trilha cai num tipo de operação em português. */

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
  });
}

/** Entidades que o código grava na trilha: `entity: "x"`, `ENTITY = "x"` e o 4º argumento de `authorize`. */
function entitiesInCode(): string[] {
  const found = new Set<string>();
  for (const file of [...sources("src/application"), ...sources("src/actions")]) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/(?:entity:\s*|ENTITY\s*=\s*)"([a-z_]+)"/g)) found.add(m[1]!);
    for (const m of text.matchAll(/authorize\(\s*\w+,\s*\w+,\s*"[a-z_.]+",\s*"([a-z_]+)"/g)) found.add(m[1]!);
  }
  return [...found].sort();
}

describe("tipos de operação da auditoria (spec 019, FR-003)", () => {
  it("são 11, cada um com o nome que a pessoa vê", () => {
    expect(OPERATION_TYPES.map((t) => OPERATION_TYPE_LABELS[t])).toEqual([
      "Itens e grupos",
      "Produtos e adicionais",
      "Fornecedores",
      "Lançamentos de estoque",
      "Mesas e QR code",
      "Pedidos",
      "Contas da mesa",
      "Caixa do dia",
      "Cardápio",
      "Equipe e acessos",
      "Configurações do restaurante",
    ]);
  });

  it("toda entidade que o código grava na trilha tem tipo", () => {
    const code = entitiesInCode();
    expect(code.length).toBeGreaterThan(15);
    expect(code.filter((e) => operationTypeOf(e) === null)).toEqual([]);
  });

  it("cada entidade é de um tipo só, e o tipo devolve as suas entidades", () => {
    const all = OPERATION_TYPES.flatMap(entitiesOf);
    expect(new Set(all).size).toBe(all.length);
    for (const t of OPERATION_TYPES) for (const e of entitiesOf(t)) expect(operationTypeOf(e)).toBe(t);
  });

  it("exemplos: acerto é lançamento de estoque, conta é conta da mesa, convite é equipe", () => {
    expect(operationTypeOf("adjustment_request")).toBe("STOCK");
    expect(operationTypeOf("stock_movement")).toBe("STOCK");
    expect(operationTypeOf("table_tab")).toBe("TABS");
    expect(operationTypeOf("invitation")).toBe("TEAM");
    expect(operationTypeOf("addon")).toBe("PRODUCTS");
    expect(operationTypeOf("o_que_nao_existe")).toBeNull();
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { DEFAULT_GROUP_TREE, NEXT_GROUP_CODE_AFTER_DEFAULT, STORAGE_CLASS_LABELS } from "./default-tree";

/** Linhas da tabela "Árvore de grupos padrão" do doc 01: [grupo, entra no CMV?]. */
function docTree() {
  const doc = readFileSync(
    path.resolve(import.meta.dirname, "../../../docs/produto/estoque/01-grupos-de-itens.md"),
    "utf8",
  );
  const table = doc.split("## Árvore de grupos padrão")[1]!.split("\n\n")[2]!;
  return table
    .split("\n")
    .slice(2)
    .map((line) => line.split("|").map((c) => c.trim()))
    .map((c) => [c[1], c[4]!.startsWith("Sim")]);
}

describe("árvore padrão de grupos (docs/produto/estoque/01-grupos-de-itens.md#árvore-de-grupos-padrão)", () => {
  it("tem os 13 grupos com códigos 01 a 13 únicos", () => {
    expect(DEFAULT_GROUP_TREE.map((g) => g.code)).toEqual([
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
      "08",
      "09",
      "10",
      "11",
      "12",
      "13",
    ]);
    expect(NEXT_GROUP_CODE_AFTER_DEFAULT).toBe(14);
  });

  it("Higiene e limpeza é químico e não entra no CMV", () => {
    const g = DEFAULT_GROUP_TREE.find((x) => x.name === "Higiene e limpeza")!;
    expect(g.storageClass).toBe("CHEMICAL");
    expect(g.inCogs).toBe(false);
  });

  it("os grupos de alimentos são FOOD e entram no CMV", () => {
    const food = DEFAULT_GROUP_TREE.filter((g) => g.storageClass === "FOOD").map((g) => g.name);
    expect(food).toEqual([
      "Hortifrúti (FLV)",
      "Carnes e aves",
      "Pescados e frutos do mar",
      "Laticínios, frios e ovos",
      "Congelados",
      "Secos e mercearia",
      "Padaria",
      "Bebidas",
      "Produção própria",
    ]);
    expect(DEFAULT_GROUP_TREE.filter((g) => g.storageClass === "FOOD").every((g) => g.inCogs)).toBe(true);
  });

  it("embalagens de delivery entram no CMV mesmo sem ser alimento", () => {
    const g = DEFAULT_GROUP_TREE.find((x) => x.name === "Embalagens de delivery")!;
    expect(g.storageClass).toBe("OTHER_NON_FOOD");
    expect(g.inCogs).toBe(true);
  });

  it("todo grupo tem subgrupos de exemplo com códigos de 2 dígitos únicos no grupo", () => {
    for (const g of DEFAULT_GROUP_TREE) {
      expect(g.subgroups.length, g.name).toBeGreaterThan(0);
      const codes = g.subgroups.map((s) => s.code);
      expect(new Set(codes).size).toBe(codes.length);
      codes.forEach((c) => expect(c).toMatch(/^\d{2}$/));
    }
  });

  it("Hortifrúti > Legumes tem o código 01.02 (cenário 1.1 da spec)", () => {
    const g = DEFAULT_GROUP_TREE[0]!;
    expect(g.subgroups.find((s) => s.name === "Legumes")?.code).toBe("02");
  });

  it("grupos e o que entra no CMV são os da tabela do doc 01, na mesma ordem (spec 018)", () => {
    expect(DEFAULT_GROUP_TREE.map((g) => [g.name, g.inCogs])).toEqual(docTree());
  });

  it("guarda de cada grupo e nomes das guardas", () => {
    expect(DEFAULT_GROUP_TREE.map((g) => g.storageClass)).toEqual([
      ...Array(9).fill("FOOD"),
      "OTHER_NON_FOOD",
      "OTHER_NON_FOOD",
      "CHEMICAL",
      "OTHER_NON_FOOD",
    ]);
    expect(STORAGE_CLASS_LABELS).toEqual({
      FOOD: "Alimentar",
      CHEMICAL: "Químico (limpeza)",
      OTHER_NON_FOOD: "Não alimentar",
    });
  });

  it("subgrupos de exemplo de cada grupo, numerados a partir de 01", () => {
    expect(DEFAULT_GROUP_TREE.map((g) => g.subgroups.map((s) => `${s.code} ${s.name}`).join(", "))).toEqual([
      "01 Folhosas, 02 Legumes, 03 Frutas, 04 Ervas",
      "01 Bovinos, 02 Suínos, 03 Aves, 04 Embutidos",
      "01 Peixes, 02 Crustáceos, 03 Moluscos",
      "01 Queijos, 02 Creme e manteiga, 03 Frios fatiados, 04 Ovos",
      "01 Proteínas congeladas, 02 Batata pré-frita, 03 Polpas, 04 Sorvetes",
      "01 Grãos, 02 Farinhas, 03 Massas, 04 Açúcares, 05 Enlatados, 06 Óleos, 07 Temperos, 08 Molhos",
      "01 Pães, 02 Massas prontas",
      "01 Não alcoólicas, 02 Cervejas, 03 Chope, 04 Vinhos, 05 Destilados, 06 Insumos de bar",
      "01 Fundos, 02 Molhos, 03 Bases, 04 Porcionados, 05 Sobremesas",
      "01 Potes, 02 Sacolas, 03 Talheres descartáveis",
      "01 Filmes e papel-alumínio, 02 Luvas, 03 Toucas",
      "01 Sanitizantes, 02 Detergentes, 03 Insumos de lava-louças",
      "01 EPIs, 02 Uniformes, 03 Utensílios, 04 Louças, 05 Enxoval, 06 Escritório, 07 Manutenção",
    ]);
  });
});

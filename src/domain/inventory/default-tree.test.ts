import { describe, it, expect } from "vitest";
import { DEFAULT_GROUP_TREE, NEXT_GROUP_CODE_AFTER_DEFAULT } from "./default-tree";

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
});

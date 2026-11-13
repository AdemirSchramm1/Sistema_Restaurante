import { describe, it, expect } from "vitest";
import { groupBy } from "./collections";

describe("groupBy: junção em memória por chave (spec 012, R7)", () => {
  const lines = [
    { orderId: "a", n: 1 },
    { orderId: "b", n: 2 },
    { orderId: "a", n: 3 },
  ];

  it("agrupa pela chave mantendo a ordem de entrada dentro do grupo", () => {
    const byOrder = groupBy(lines, (l) => l.orderId);
    expect(byOrder.get("a")?.map((l) => l.n)).toEqual([1, 3]);
    expect(byOrder.get("b")?.map((l) => l.n)).toEqual([2]);
  });

  it("chave sem itens não existe no mapa", () => {
    expect(groupBy(lines, (l) => l.orderId).get("c")).toBeUndefined();
    expect(groupBy([], (l: { k: string }) => l.k).size).toBe(0);
  });

  it("lê a lista uma vez só, qualquer que seja o número de grupos", () => {
    let reads = 0;
    const many = Array.from({ length: 1000 }, (_, i) => ({ k: String(i % 100) }));
    groupBy(many, (x) => {
      reads++;
      return x.k;
    });
    expect(reads).toBe(1000);
  });
});

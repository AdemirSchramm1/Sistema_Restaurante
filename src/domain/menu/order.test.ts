import { describe, expect, it } from "vitest";
import { appendPosition, canMove, isDirection, move } from "./order";

const ids = ["a", "b", "c", "d"];

describe("subir e descer (docs/produto/pedidos/06-editar-o-cardapio.md#ordem)", () => {
  it("subir troca com o vizinho de cima", () => {
    expect(move(ids, "c", "up")).toEqual({ ok: true, value: ["a", "c", "b", "d"] });
    expect(move(ids, "b", "up")).toEqual({ ok: true, value: ["b", "a", "c", "d"] });
  });

  it("descer troca com o vizinho de baixo", () => {
    expect(move(ids, "b", "down")).toEqual({ ok: true, value: ["a", "c", "b", "d"] });
    expect(move(ids, "c", "down")).toEqual({ ok: true, value: ["a", "b", "d", "c"] });
  });

  it("o primeiro não sobe e o último não desce: NO_CHANGE", () => {
    expect(move(ids, "a", "up")).toEqual({ ok: false, error: { code: "NO_CHANGE" } });
    expect(move(ids, "d", "down")).toEqual({ ok: false, error: { code: "NO_CHANGE" } });
    expect(move(["só"], "só", "up")).toEqual({ ok: false, error: { code: "NO_CHANGE" } });
    expect(move(["só"], "só", "down")).toEqual({ ok: false, error: { code: "NO_CHANGE" } });
  });

  it("quem não está na lista é NOT_FOUND", () => {
    expect(move(ids, "z", "up")).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
    expect(move([], "a", "down")).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("não muda a lista recebida e não perde nem repete ninguém", () => {
    const before = [...ids];
    const moved = move(ids, "a", "down");
    expect(ids).toEqual(before);
    expect(moved.ok && [...moved.value].sort()).toEqual(before);
  });

  it("diz quem pode subir e quem pode descer", () => {
    expect(canMove(ids, "a")).toEqual({ up: false, down: true });
    expect(canMove(ids, "b")).toEqual({ up: true, down: true });
    expect(canMove(ids, "d")).toEqual({ up: true, down: false });
    expect(canMove(["só"], "só")).toEqual({ up: false, down: false });
    expect(canMove(ids, "z")).toEqual({ up: false, down: false });
  });

  it("só aceita as direções up e down", () => {
    expect(isDirection("up")).toBe(true);
    expect(isDirection("down")).toBe(true);
    for (const v of ["UP", "left", "", null, undefined, 1]) expect(isDirection(v)).toBe(false);
  });
});

describe("produto novo entra no fim (spec 013, US3.2 e US3.3)", () => {
  it("grupo vazio começa em 1", () => {
    expect(appendPosition([])).toBe(1);
  });

  it("vai depois da maior posição, mesmo com buraco ou fora de ordem", () => {
    expect(appendPosition([1, 2, 3])).toBe(4);
    expect(appendPosition([3, 1])).toBe(4);
    expect(appendPosition([7])).toBe(8);
    expect(appendPosition([0])).toBe(1);
  });
});

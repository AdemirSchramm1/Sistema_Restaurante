import { describe, it, expect } from "vitest";
import { diffFields } from "./audit";
import { d } from "./decimal";

describe("diferença de campos para a trilha de auditoria (FR-004)", () => {
  it("lista só os campos alterados com antes e depois", () => {
    expect(diffFields({ a: 1, b: "x" }, { a: 2, b: "x" })).toEqual({ a: [1, 2] });
  });

  it("compara decimais pelo valor e grava como texto", () => {
    expect(diffFields({ f: d("20") }, { f: d("20.0") })).toEqual({});
    expect(diffFields({ f: d("20") }, { f: d("12") })).toEqual({ f: ["20", "12"] });
  });

  it("compara listas e datas pelo conteúdo", () => {
    expect(
      diffFields(
        { l: ["a"], t: new Date("2026-01-01T00:00:00Z") },
        { l: ["a"], t: new Date("2026-01-01T00:00:00Z") },
      ),
    ).toEqual({});
    expect(diffFields({ l: ["a"] }, { l: ["a", "b"] })).toEqual({ l: [["a"], ["a", "b"]] });
  });

  it("trata campo novo e campo removido como null", () => {
    expect(diffFields({}, { x: true })).toEqual({ x: [null, true] });
    expect(diffFields({ x: true }, { x: null })).toEqual({ x: [true, null] });
  });

  it("na criação, registra todos os campos preenchidos", () => {
    expect(diffFields(null, { a: 1, b: null })).toEqual({ a: [null, 1] });
  });
});

describe("o que o histórico grava (spec 018)", () => {
  it("datas e listas de decimais viram texto; vazio dentro da lista vira null", () => {
    const at = new Date("2026-11-02T12:00:00Z");
    expect(diffFields({ at: null, list: [] }, { at, list: [d("1.50"), undefined] })).toEqual({
      at: [null, "2026-11-02T12:00:00.000Z"],
      list: [[], ["1.5", null]],
    });
  });

  it("decimal com zeros à direita é o mesmo valor; decimal para vazio é mudança", () => {
    expect(diffFields({ price: d("1.0") }, { price: d("1") })).toEqual({});
    expect(diffFields({ price: d("1") }, { price: null })).toEqual({ price: ["1", null] });
  });
});

import { describe, it, expect } from "vitest";
import { firstParam } from "./search-params";

describe("firstParam: lê um filtro da URL (spec 012, FR-011)", () => {
  it("devolve o texto do parâmetro", () => {
    expect(firstParam("abc")).toBe("abc");
  });

  it("ignora parâmetro vazio, repetido (lista) ou ausente", () => {
    expect(firstParam("")).toBeUndefined();
    expect(firstParam(["a", "b"])).toBeUndefined();
    expect(firstParam(undefined)).toBeUndefined();
  });
});

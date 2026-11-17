import { describe, expect, it } from "vitest";
import { matchesSearch, normalizeSearch } from "./search";

describe("busca no cardápio da equipe (spec 015, US5-2)", () => {
  it("tira acento, caixa e espaços das pontas", () => {
    expect(normalizeSearch("  Purê de BATATA ")).toBe("pure de batata");
    expect(normalizeSearch("Pão de Açúcar")).toBe("pao de acucar");
  });

  it("acha pelo pedaço do nome sem diferenciar maiúsculas e acentos", () => {
    expect(matchesSearch("Purê de batata", "pure")).toBe(true);
    expect(matchesSearch("X-Burger", "burg")).toBe(true);
    expect(matchesSearch("X-Burger", "BURG")).toBe(true);
    expect(matchesSearch("Chope", "pure")).toBe(false);
  });

  it("busca vazia acha tudo", () => {
    expect(matchesSearch("Chope", "")).toBe(true);
    expect(matchesSearch("Chope", "   ")).toBe(true);
  });
});

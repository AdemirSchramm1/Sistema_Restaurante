import { describe, it, expect } from "vitest";
import { compareTableNames, tableRange, validateTableName } from "./table-name";

describe("nome da mesa (spec 009, FR-001)", () => {
  it("de 1 a 30 caracteres, sem espaço nas pontas", () => {
    expect(validateTableName(" 12 ")).toEqual({ ok: true, value: { name: "12", normalized: "12" } });
    expect(validateTableName("a".repeat(30)).ok).toBe(true);
    for (const bad of ["", "   ", "a".repeat(31)]) {
      const r = validateTableName(bad);
      expect(!r.ok && r.error.code, JSON.stringify(bad)).toBe("INVALID_TABLE_NAME");
    }
  });

  it("compara sem acento e sem diferenciar maiúsculas", () => {
    const a = validateTableName("Varanda Três");
    const b = validateTableName("varanda  tres");
    expect(a.ok && b.ok && a.value.normalized === b.value.normalized).toBe(true);
  });
});

describe("criar várias mesas (spec 009, US1-3)", () => {
  it("de 1 a 20 gera os nomes 1 a 20", () => {
    const r = tableRange(1, 20);
    expect(r.ok && r.value).toEqual(Array.from({ length: 20 }, (_, i) => String(i + 1)));
  });

  it("de 1 a 999, até 200 de uma vez, inteiros, início ≤ fim", () => {
    expect(tableRange(800, 999).ok).toBe(true);
    for (const [a, b] of [
      [0, 5],
      [1, 1000],
      [1, 201],
      [5, 1],
      [1.5, 3],
    ]) {
      const r = tableRange(a!, b!);
      expect(!r.ok && r.error.code, `${a}-${b}`).toBe("INVALID_RANGE");
    }
    expect(tableRange(1, 200).ok).toBe(true);
  });
});

describe("ordem das mesas", () => {
  it('ordem natural: "2" antes de "10", texto depois de números', () => {
    expect(["10", "2", "Varanda 1", "1"].sort(compareTableNames)).toEqual(["1", "2", "10", "Varanda 1"]);
  });
});

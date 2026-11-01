import { describe, it, expect } from "vitest";
import { LOCATION_KIND_OPTIONS, orderLocations, validateLocation, type LocationData } from "./location";

const loc = (over: Partial<LocationData> = {}): LocationData => ({
  name: "Geladeira da cozinha",
  kind: "CHILLED",
  ...over,
});
const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "OK" : r.error!.code);

describe("locais de armazenamento (docs/produto/estoque/05-locais.md#critérios-de-aceite-para-a-spec)", () => {
  it("local precisa só de nome e tipo, sem temperatura", () => {
    expect(code(validateLocation(loc()))).toBe("OK");
    expect(code(validateLocation(loc({ kind: "FROZEN" })))).toBe("OK");
  });

  it("nome entre 2 e 80 caracteres", () => {
    expect(code(validateLocation(loc({ name: " " })))).toBe("VALIDATION");
    expect(code(validateLocation(loc({ name: "x".repeat(81) })))).toBe("VALIDATION");
  });

  it("recusa tipo desconhecido", () => {
    expect(code(validateLocation(loc({ kind: "XYZ" as never })))).toBe("VALIDATION");
  });

  it("a tela oferece só tipos simples, sem quarentena nem trânsito", () => {
    expect(LOCATION_KIND_OPTIONS).not.toContain("QUARANTINE");
    expect(LOCATION_KIND_OPTIONS).not.toContain("IN_TRANSIT");
    expect(LOCATION_KIND_OPTIONS).toContain("CHILLED");
  });

  it("locais em ordem alfabética", () => {
    const r = orderLocations([{ name: "Freezer" }, { name: "Bar" }, { name: "Câmara" }]);
    expect(r.map((x) => x.name)).toEqual(["Bar", "Câmara", "Freezer"]);
  });
});

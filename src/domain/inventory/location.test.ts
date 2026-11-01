import { describe, it, expect } from "vitest";
import {
  checkItemLocation,
  orderCountSheet,
  orderLocations,
  validateLocation,
  LOCATION_KINDS,
  type LocationData,
} from "./location";
import { d } from "../shared/decimal";

const loc = (over: Partial<LocationData> = {}): LocationData => ({
  name: "Câmara de carnes",
  kind: "CHILLED",
  tempMinC: d(0),
  tempMaxC: d(4),
  responsibleUserId: null,
  countOrder: 1,
  ...over,
});
const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "OK" : r.error!.code);

describe("locais de armazenamento (docs/produto/estoque/05-locais.md#critérios-de-aceite-para-a-spec)", () => {
  it("refrigerado e congelado exigem faixa de temperatura", () => {
    expect(code(validateLocation(loc({ tempMinC: null, tempMaxC: null })))).toBe(
      "TEMPERATURE_RANGE_REQUIRED",
    );
    expect(code(validateLocation(loc({ kind: "FROZEN", tempMinC: d(-25), tempMaxC: null })))).toBe(
      "TEMPERATURE_RANGE_REQUIRED",
    );
    expect(code(validateLocation(loc()))).toBe("OK");
  });

  it("mínima maior que a máxima é recusada (cenário 3.3)", () => {
    expect(code(validateLocation(loc({ kind: "FROZEN", tempMinC: d(-10), tempMaxC: d(-18) })))).toBe(
      "TEMPERATURE_RANGE_INVALID",
    );
    expect(code(validateLocation(loc({ kind: "DRY", tempMinC: d(30), tempMaxC: d(10) })))).toBe(
      "TEMPERATURE_RANGE_INVALID",
    );
  });

  it("local seco não precisa de faixa", () => {
    expect(code(validateLocation(loc({ kind: "DRY", tempMinC: null, tempMaxC: null })))).toBe("OK");
  });

  it("exige nome e ordem de contagem não negativa", () => {
    expect(code(validateLocation(loc({ name: " " })))).toBe("VALIDATION");
    expect(code(validateLocation(loc({ countOrder: -1 })))).toBe("VALIDATION");
  });
});

describe("compatibilidade item × local (cenário 3.4, FR-029)", () => {
  it("produto de limpeza só em químicos, quarentena ou trânsito", () => {
    for (const kind of LOCATION_KINDS) {
      const expected = ["CHEMICALS", "QUARANTINE", "IN_TRANSIT"].includes(kind)
        ? "OK"
        : "LOCATION_INCOMPATIBLE";
      expect(code(checkItemLocation("CHEMICAL", kind)), kind).toBe(expected);
    }
  });

  it("alimento e outros não alimentares em qualquer local menos químicos", () => {
    for (const cls of ["FOOD", "OTHER_NON_FOOD"] as const)
      for (const kind of LOCATION_KINDS) {
        const expected = kind === "CHEMICALS" ? "LOCATION_INCOMPATIBLE" : "OK";
        expect(code(checkItemLocation(cls, kind)), `${cls} em ${kind}`).toBe(expected);
      }
  });
});

describe("ordem da folha de contagem (cenário 3.6, FR-016)", () => {
  it("itens na ordem da posição: 3, 1, 2 → 1, 2, 3", () => {
    const sheet = orderCountSheet([
      { sheetPosition: 3, code: "c" },
      { sheetPosition: 1, code: "a" },
      { sheetPosition: 2, code: "b" },
    ]);
    expect(sheet.map((x) => x.code)).toEqual(["a", "b", "c"]);
  });

  it("empate na posição desempata pelo código", () => {
    expect(
      orderCountSheet([
        { sheetPosition: 1, code: "02" },
        { sheetPosition: 1, code: "01" },
      ]).map((x) => x.code),
    ).toEqual(["01", "02"]);
  });

  it("locais na ordem da rota e, no empate, pelo nome", () => {
    const r = orderLocations([
      { countOrder: 2, name: "Bar" },
      { countOrder: 1, name: "Seco" },
      { countOrder: 1, name: "Câmara" },
    ]);
    expect(r.map((x) => x.name)).toEqual(["Câmara", "Seco", "Bar"]);
  });
});

import { describe, expect, it } from "vitest";
import { parseLocationForm } from "./location-input";

const base = {
  name: "Câmara de carnes",
  kind: "CHILLED",
  tempMinC: "0",
  tempMaxC: "4,5",
  responsibleUserId: "",
  countOrder: "10",
};

describe("parseLocationForm", () => {
  it("lê temperaturas com vírgula como decimal exato e responsável vazio como nulo", () => {
    const r = parseLocationForm(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.tempMaxC?.toString()).toBe("4.5");
    expect(r.value.responsibleUserId).toBeNull();
    expect(r.value.countOrder).toBe(10);
  });

  it("temperatura vazia vira nulo e ordem vazia vira 0", () => {
    const r = parseLocationForm({ ...base, kind: "DRY", tempMinC: "", tempMaxC: "", countOrder: "" });
    expect(r).toMatchObject({ ok: true, value: { tempMinC: null, tempMaxC: null, countOrder: 0 } });
  });

  it("recusa número inválido apontando o campo", () => {
    expect(parseLocationForm({ ...base, tempMinC: "abc" })).toMatchObject({
      ok: false,
      error: { code: "INVALID_NUMBER", field: "tempMinC" },
    });
  });

  it("recusa tipo desconhecido e ordem não inteira", () => {
    expect(parseLocationForm({ ...base, kind: "XYZ" })).toMatchObject({
      ok: false,
      error: { field: "kind" },
    });
    expect(parseLocationForm({ ...base, countOrder: "1,5" })).toMatchObject({
      ok: false,
      error: { field: "countOrder" },
    });
  });
});

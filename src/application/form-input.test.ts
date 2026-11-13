import { describe, expect, it } from "vitest";
import { componentRef, formDataToObject, formText, isId, optionalDecimal, optionalText } from "./form-input";

const ID = "0193a000-0000-7000-8000-000000000123";

describe("formText (spec 012, FR-011)", () => {
  it("devolve o texto sem espaços nas pontas", () => {
    expect(formText("  Tomate italiano ")).toBe("Tomate italiano");
    expect(formText("Arroz")).toBe("Arroz");
  });

  it("o que não é texto vira texto vazio", () => {
    for (const v of [undefined, null, 3, true, ["a"], { a: 1 }]) expect(formText(v)).toBe("");
  });

  it("só espaços vira texto vazio", () => {
    expect(formText("   ")).toBe("");
  });
});

describe("optionalText", () => {
  it("campo opcional em branco vira null; com texto, vem aparado", () => {
    expect(optionalText("  Entregar pela manhã ")).toBe("Entregar pela manhã");
    for (const v of ["", "   ", undefined, null, 3]) expect(optionalText(v)).toBeNull();
  });
});

describe("optionalDecimal", () => {
  it("em branco é null; com vírgula vira decimal exato", () => {
    expect(optionalDecimal("", "price")).toEqual({ ok: true, value: null });
    expect(optionalDecimal(undefined, "price")).toEqual({ ok: true, value: null });
    const r = optionalDecimal(" 1.234,56 ", "price");
    expect(r.ok && r.value?.toFixed(2)).toBe("1234.56");
  });

  it("texto que não é número aponta o campo com o código pedido", () => {
    expect(optionalDecimal("dois", "parLevel")).toMatchObject({
      ok: false,
      error: { code: "INVALID_NUMBER", field: "parLevel" },
    });
    expect(optionalDecimal("1,2,3", "minOrderValue", "INVALID_AMOUNT")).toMatchObject({
      ok: false,
      error: { code: "INVALID_AMOUNT", field: "minOrderValue" },
    });
  });
});

describe("isId", () => {
  it("aceita o id do banco em maiúsculas ou minúsculas e recusa o resto", () => {
    expect(isId(ID)).toBe(true);
    expect(isId(ID.toUpperCase())).toBe(true);
    for (const v of ["", "123", `${ID}0`, ` ${ID}`, "0193a000-0000-7000-8000-00000000012g"])
      expect(isId(v)).toBe(false);
  });
});

describe("componentRef", () => {
  it("lê 'ITEM:id' e 'RECIPE:id' dos selects de componente", () => {
    expect(componentRef(`ITEM:${ID}`)).toEqual({ kind: "ITEM", id: ID });
    expect(componentRef(` RECIPE:${ID} `)).toEqual({ kind: "RECIPE", id: ID });
  });

  it("outro tipo, id malformado ou campo vazio dá null", () => {
    for (const v of [`ADDON:${ID}`, "ITEM:123", "ITEM:", `ITEM:${ID}:x`, ID, "", undefined])
      expect(componentRef(v)).toBeNull();
  });
});

describe("formDataToObject", () => {
  it("copia os campos de texto e ignora os internos do Next e os arquivos", () => {
    const form = new FormData();
    form.append("name", "Tomate");
    form.append("$ACTION_ID_abc", "");
    form.append("$ACTION_REF_1", "");
    form.append("photo", new Blob(["x"]), "foto.png");
    expect(formDataToObject(form)).toEqual({ name: "Tomate" });
  });

  it("campo repetido fica com o último valor (listas usam form.getAll)", () => {
    const form = new FormData();
    form.append("deliveryDays", "1");
    form.append("deliveryDays", "4");
    expect(formDataToObject(form)).toEqual({ deliveryDays: "4" });
  });
});

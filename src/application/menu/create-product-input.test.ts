import { describe, expect, it } from "vitest";
import { parseMenuProductCreate } from "./create-product-input";

const item = "0193a000-0000-7000-8000-000000000010";
const section = "0193a000-0000-7000-8000-000000000020";
const form = (over: Record<string, unknown> = {}) => ({
  name: "Suco de laranja",
  "lines.0.component": `ITEM:${item}`,
  "lines.0.quantity": "0,300",
  "lines.0.unit": "l",
  salePrice: "9,00",
  sectionId: section,
  description: " Feito na hora. ",
  ...over,
});
const show = (r: { ok: boolean; error?: { code: string; field?: string } }) =>
  r.ok ? "OK" : `${r.error!.code}:${r.error!.field}`;

describe("formulário de produto novo do Cardápio (spec 013, US4)", () => {
  it("lê nome, linhas da 003, preço em formato brasileiro, seção e descrição como veio", () => {
    const r = parseMenuProductCreate(form());
    if (!r.ok) throw new Error(show(r));
    expect(r.value.name).toBe("Suco de laranja");
    expect(r.value.lines).toHaveLength(1);
    expect(r.value.lines[0]!.component).toEqual({ kind: "ITEM", id: item });
    expect(r.value.lines[0]!.quantity.toFixed(3)).toBe("0.300");
    expect(r.value.lines[0]!.unit).toBe("l");
    expect(r.value.salePrice!.toFixed(2)).toBe("9.00");
    expect(r.value.sectionId).toBe(section);
    expect(r.value.description).toBe(" Feito na hora. ");
  });

  it("preço, seção e descrição em branco ou ausentes: sem preço, Outros, sem descrição", () => {
    for (const over of [
      { salePrice: "", sectionId: "", description: "" },
      { salePrice: undefined, sectionId: undefined, description: undefined },
    ]) {
      const r = parseMenuProductCreate(form(over));
      if (!r.ok) throw new Error(show(r));
      expect(r.value).toMatchObject({ salePrice: null, sectionId: null, description: "" });
    }
  });

  it("é sempre produto vendido: o tipo e o rendimento não vêm do formulário", () => {
    expect(show(parseMenuProductCreate(form({ kind: "SUB_RECIPE" })))).toBe("VALIDATION:undefined");
    expect(show(parseMenuProductCreate(form({ yieldQuantity: "2" })))).toBe("VALIDATION:undefined");
  });

  it("aponta o campo com problema", () => {
    expect(show(parseMenuProductCreate(form({ salePrice: "nove" })))).toBe("INVALID_PRICE:salePrice");
    expect(show(parseMenuProductCreate(form({ sectionId: "bebidas" })))).toBe("VALIDATION:sectionId");
    expect(show(parseMenuProductCreate(form({ "lines.0.quantity": "" })))).toBe(
      "INVALID_QUANTITY:lines.0.quantity",
    );
    expect(show(parseMenuProductCreate(form({ "lines.0.unit": "xícara" })))).toBe(
      "UNKNOWN_UNIT:lines.0.unit",
    );
  });
});

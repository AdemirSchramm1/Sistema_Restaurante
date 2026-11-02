import { describe, it, expect } from "vitest";
import { parseSupplierForm, parseSupplierItemForm } from "./supplier-input";

const ITEM = "0193a000-0000-7000-8000-000000000123";
const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "OK" : r.error!.code);
const field = (r: { ok: boolean; error?: { field?: string } }) => (r.ok ? undefined : r.error!.field);

describe("formulário do fornecedor (spec 007, US1)", () => {
  it("só o nome; campos vazios viram null e sem dias de entrega", () => {
    const r = parseSupplierForm({
      name: "Hortifruti do João",
      cnpj: "",
      leadTimeDays: "",
      minOrderValue: "",
    });
    expect(r.ok && r.value).toMatchObject({
      name: "Hortifruti do João",
      cnpj: null,
      deliveryDays: [],
      leadTimeDays: null,
      minOrderValue: null,
    });
  });

  it("lê dias marcados, prazo inteiro e pedido mínimo em reais", () => {
    const r = parseSupplierForm({
      name: "Açougue",
      cnpj: "11.222.333/0001-81",
      deliveryDays: ["1", "4"],
      leadTimeDays: "2",
      minOrderValue: "1.250,50",
      paymentTerms: " Boleto 28 dias ",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.deliveryDays).toEqual([1, 4]);
    expect(r.value.leadTimeDays).toBe(2);
    expect(r.value.minOrderValue?.toString()).toBe("1250.5");
    expect(r.value.cnpj).toBe("11.222.333/0001-81");
    expect(r.value.paymentTerms).toBe("Boleto 28 dias");
  });

  it("um dia só chega como texto, não lista", () => {
    const r = parseSupplierForm({ name: "Açougue", deliveryDays: "3" });
    expect(r.ok && r.value.deliveryDays).toEqual([3]);
  });

  it("prazo e pedido mínimo inválidos apontam o campo", () => {
    expect(field(parseSupplierForm({ name: "Açougue", leadTimeDays: "dois" }))).toBe("leadTimeDays");
    const min = parseSupplierForm({ name: "Açougue", minOrderValue: "abc" });
    expect(code(min)).toBe("INVALID_AMOUNT");
    expect(field(min)).toBe("minOrderValue");
    expect(field(parseSupplierForm({ name: "Açougue", deliveryDays: ["x"] }))).toBe("deliveryDays");
  });

  it("campo desconhecido é recusado", () => {
    expect(code(parseSupplierForm({ name: "Açougue", sif: "123" }))).toBe("VALIDATION");
  });
});

describe("formulário do item do fornecedor (spec 007, US2)", () => {
  it("caixa de 18 kg a R$ 90,00, preferido", () => {
    const r = parseSupplierItemForm({
      itemId: ITEM,
      price: "90,00",
      packageLabel: "Caixa",
      packageQuantity: "18",
      preferred: "on",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.price.toString()).toBe("90");
    expect(r.value.packageQuantity?.toString()).toBe("18");
    expect(r.value.preferred).toBe(true);
  });

  it("sem embalagem e sem marcar preferido", () => {
    const r = parseSupplierItemForm({ itemId: ITEM, price: "4,80", packageLabel: "", packageQuantity: "" });
    expect(r.ok && [r.value.packageLabel, r.value.packageQuantity, r.value.preferred]).toEqual([
      null,
      null,
      false,
    ]);
  });

  it("preço vazio ou inválido é INVALID_PRICE; item obrigatório", () => {
    expect(code(parseSupplierItemForm({ itemId: ITEM, price: "" }))).toBe("INVALID_PRICE");
    expect(code(parseSupplierItemForm({ itemId: ITEM, price: "noventa" }))).toBe("INVALID_PRICE");
    expect(field(parseSupplierItemForm({ itemId: "", price: "1" }))).toBe("itemId");
  });

  it("na edição o item não vem no formulário", () => {
    const r = parseSupplierItemForm({ price: "1" }, { requireItem: false });
    expect(code(r)).toBe("OK");
  });
});

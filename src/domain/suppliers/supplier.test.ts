import { describe, it, expect } from "vitest";
import {
  cheapestOffer,
  pricePerUnit,
  validateSupplier,
  validateSupplierItem,
  WEEKDAY_LABELS,
  type SupplierData,
  type SupplierItemData,
} from "./supplier";
import { d } from "../shared/decimal";

const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "OK" : r.error!.code);
const field = (r: { ok: boolean; error?: { field?: string } }) => (r.ok ? undefined : r.error!.field);

const supplier = (over: Partial<SupplierData> = {}): SupplierData => ({
  name: "Hortifruti do João",
  legalName: null,
  cnpj: null,
  contactName: null,
  phone: null,
  email: null,
  deliveryDays: [],
  leadTimeDays: null,
  minOrderValue: null,
  paymentTerms: null,
  notes: null,
  ...over,
});

describe("cadastro do fornecedor (US1, FR-001, FR-002)", () => {
  it("só o nome basta", () => {
    expect(code(validateSupplier(supplier()))).toBe("OK");
  });

  it("nome com 3 a 120 letras", () => {
    expect(code(validateSupplier(supplier({ name: "  Jo " })))).toBe("INVALID_NAME");
    expect(field(validateSupplier(supplier({ name: "x".repeat(121) })))).toBe("name");
  });

  it("devolve os dados limpos: textos aparados, CNPJ sem pontuação, dias em ordem sem repetir", () => {
    const r = validateSupplier(
      supplier({
        name: "  Açougue Boi Bom ",
        legalName: "  ",
        cnpj: "11.222.333/0001-81",
        email: " Vendas@BoiBom.com.br ",
        deliveryDays: [5, 1, 3, 1],
      }),
    );
    expect(r.ok && r.value).toMatchObject({
      name: "Açougue Boi Bom",
      legalName: null,
      cnpj: "11222333000181",
      email: "vendas@boibom.com.br",
      deliveryDays: [1, 3, 5],
    });
  });

  it("CNPJ inválido é recusado", () => {
    const r = validateSupplier(supplier({ cnpj: "11.222.333/0001-80" }));
    expect(code(r)).toBe("INVALID_CNPJ");
    expect(field(r)).toBe("cnpj");
  });

  it("e-mail precisa ter cara de e-mail", () => {
    expect(code(validateSupplier(supplier({ email: "joao@" })))).toBe("INVALID_EMAIL");
  });

  it("dias da semana de 0 (domingo) a 6 (sábado)", () => {
    expect(WEEKDAY_LABELS).toHaveLength(7);
    expect(field(validateSupplier(supplier({ deliveryDays: [7] })))).toBe("deliveryDays");
    expect(field(validateSupplier(supplier({ deliveryDays: [-1] })))).toBe("deliveryDays");
  });

  it("prazo de entrega de 0 a 90 dias inteiros", () => {
    expect(code(validateSupplier(supplier({ leadTimeDays: 0 })))).toBe("OK");
    expect(code(validateSupplier(supplier({ leadTimeDays: 90 })))).toBe("OK");
    expect(field(validateSupplier(supplier({ leadTimeDays: 91 })))).toBe("leadTimeDays");
    expect(field(validateSupplier(supplier({ leadTimeDays: 1.5 })))).toBe("leadTimeDays");
  });

  it("pedido mínimo em reais com até 2 casas e nunca negativo", () => {
    expect(code(validateSupplier(supplier({ minOrderValue: d("150.50") })))).toBe("OK");
    expect(code(validateSupplier(supplier({ minOrderValue: d("-1") })))).toBe("INVALID_AMOUNT");
    expect(field(validateSupplier(supplier({ minOrderValue: d("1.555") })))).toBe("minOrderValue");
  });

  it("textos longos demais são recusados no campo certo", () => {
    expect(field(validateSupplier(supplier({ paymentTerms: "x".repeat(201) })))).toBe("paymentTerms");
    expect(field(validateSupplier(supplier({ notes: "x".repeat(1001) })))).toBe("notes");
  });
});

const offer = (over: Partial<SupplierItemData> = {}): SupplierItemData => ({
  itemId: "tomate",
  packageLabel: null,
  packageQuantity: null,
  price: d("5"),
  preferred: false,
  ...over,
});

describe("item do fornecedor (US2, FR-003)", () => {
  it("preço maior que zero, com até 4 casas", () => {
    expect(code(validateSupplierItem(offer()))).toBe("OK");
    expect(code(validateSupplierItem(offer({ price: d(0) })))).toBe("INVALID_PRICE");
    expect(field(validateSupplierItem(offer({ price: d("1.00001") })))).toBe("price");
  });

  it("embalagem: nome e quantidade juntos, quantidade maior que zero", () => {
    expect(code(validateSupplierItem(offer({ packageLabel: "Caixa", packageQuantity: d(18) })))).toBe("OK");
    expect(code(validateSupplierItem(offer({ packageLabel: "Caixa" })))).toBe("PURCHASE_FACTOR_REQUIRED");
    expect(code(validateSupplierItem(offer({ packageQuantity: d(18) })))).toBe("PURCHASE_LABEL_REQUIRED");
    expect(code(validateSupplierItem(offer({ packageLabel: "Caixa", packageQuantity: d(0) })))).toBe(
      "INVALID_FACTOR",
    );
  });

  it("nome da embalagem em branco vale como sem embalagem", () => {
    const r = validateSupplierItem(offer({ packageLabel: "  " }));
    expect(r.ok && r.value.packageLabel).toBe(null);
  });
});

describe("preço por medida (FR-005, US3)", () => {
  it("caixa de 18 kg a R$ 90,00 = R$ 5,00/kg", () => {
    expect(pricePerUnit({ price: d(90), packageQuantity: d(18) }).toString()).toBe("5");
  });

  it("sem embalagem, o preço já é por medida", () => {
    expect(pricePerUnit({ price: d("4.5"), packageQuantity: null }).toString()).toBe("4.5");
  });

  it("é decimal: R$ 10,00 por 3 kg = 3,3333… (sem ponto flutuante)", () => {
    const p = pricePerUnit({ price: d(10), packageQuantity: d(3) });
    expect(p.toDecimalPlaces(4).toString()).toBe("3.3333");
    expect(p.times(3).toDecimalPlaces(10).toString()).toBe("10");
  });

  it("mais barato por medida, comparando caixas de tamanhos diferentes", () => {
    const offers = [
      { id: "a", price: d(90), packageQuantity: d(18) }, // 5,00/kg
      { id: "b", price: d("4.8"), packageQuantity: null }, // 4,80/kg
      { id: "c", price: d(100), packageQuantity: d(20) }, // 5,00/kg
    ];
    expect(cheapestOffer(offers)).toBe("b");
    expect(cheapestOffer([])).toBe(null);
  });

  it("com só um fornecedor não há 'mais barato'", () => {
    expect(cheapestOffer([{ id: "a", price: d(1), packageQuantity: null }])).toBe(null);
  });
});

describe("limites do fornecedor e do item (spec 018, US3 e R4)", () => {
  const fail = (r: { ok: boolean; error?: { code: string; field?: string } }) =>
    r.ok ? "OK" : `${r.error!.code}@${r.error!.field}`;

  it("nome: 3 e 120 letras passam; 2 e 121 não", () => {
    expect(fail(validateSupplier(supplier({ name: "abc" })))).toBe("OK");
    expect(fail(validateSupplier(supplier({ name: "a".repeat(120) })))).toBe("OK");
    expect(fail(validateSupplier(supplier({ name: "ab" })))).toBe("INVALID_NAME@name");
    expect(fail(validateSupplier(supplier({ name: "a".repeat(121) })))).toBe("INVALID_NAME@name");
  });

  it("textos no tamanho máximo passam; um a mais é VALIDATION no campo", () => {
    const cases: [keyof SupplierData, number][] = [
      ["legalName", 120],
      ["contactName", 120],
      ["phone", 40],
      ["paymentTerms", 200],
      ["notes", 1000],
    ];
    for (const [f, max] of cases) {
      expect(fail(validateSupplier(supplier({ [f]: "x".repeat(max) }))), f).toBe("OK");
      expect(fail(validateSupplier(supplier({ [f]: "x".repeat(max + 1) }))), f).toBe(`VALIDATION@${f}`);
    }
  });

  it("e-mail: o texto inteiro precisa ter cara de e-mail", () => {
    expect(fail(validateSupplier(supplier({ email: "a b@x.com" })))).toBe("INVALID_EMAIL@email");
    expect(fail(validateSupplier(supplier({ email: "a@b.c d" })))).toBe("INVALID_EMAIL@email");
    expect(fail(validateSupplier(supplier({ email: "semarroba.com" })))).toBe("INVALID_EMAIL@email");
  });

  it("dias da semana: 0 e 6 passam; -1, 7 e meio dia não", () => {
    expect(fail(validateSupplier(supplier({ deliveryDays: [0, 6] })))).toBe("OK");
    for (const day of [-1, 7, 1.5])
      expect(fail(validateSupplier(supplier({ deliveryDays: [day] }))), String(day)).toBe(
        "VALIDATION@deliveryDays",
      );
  });

  it("prazo: 0 e 90 passam; -1, 91 e meio dia não", () => {
    for (const lead of [0, 90]) expect(fail(validateSupplier(supplier({ leadTimeDays: lead })))).toBe("OK");
    for (const lead of [-1, 91, 0.5])
      expect(fail(validateSupplier(supplier({ leadTimeDays: lead }))), String(lead)).toBe(
        "VALIDATION@leadTimeDays",
      );
  });

  it("pedido mínimo com 2 casas passa; com 3 não", () => {
    expect(fail(validateSupplier(supplier({ minOrderValue: d("150.25") })))).toBe("OK");
    expect(fail(validateSupplier(supplier({ minOrderValue: d("150.255") })))).toBe(
      "INVALID_AMOUNT@minOrderValue",
    );
  });

  const item = (over: Partial<SupplierItemData> = {}): SupplierItemData => ({
    itemId: "i1",
    packageLabel: null,
    packageQuantity: null,
    price: d("10"),
    preferred: false,
    ...over,
  });

  it("preço com 4 casas passa; com 5 não", () => {
    expect(fail(validateSupplierItem(item({ price: d("1.2345") })))).toBe("OK");
    expect(fail(validateSupplierItem(item({ price: d("1.23456") })))).toBe("INVALID_PRICE@price");
  });

  it("embalagem: cada metade sem a outra é recusada no campo que falta", () => {
    expect(fail(validateSupplierItem(item({ packageLabel: "Caixa" })))).toBe(
      "PURCHASE_FACTOR_REQUIRED@packageQuantity",
    );
    expect(fail(validateSupplierItem(item({ packageQuantity: d(18) })))).toBe(
      "PURCHASE_LABEL_REQUIRED@packageLabel",
    );
  });

  it("nome da embalagem: 60 letras passam; 61 não", () => {
    const box = (label: string) => item({ packageLabel: label, packageQuantity: d(18) });
    expect(fail(validateSupplierItem(box("c".repeat(60))))).toBe("OK");
    expect(fail(validateSupplierItem(box("c".repeat(61))))).toBe("VALIDATION@packageLabel");
  });

  it("quantidade da embalagem com 4 casas passa; com 5 não", () => {
    const box = (q: string) => item({ packageLabel: "Caixa", packageQuantity: d(q) });
    expect(fail(validateSupplierItem(box("0.0001")))).toBe("OK");
    expect(fail(validateSupplierItem(box("0.00001")))).toBe("INVALID_FACTOR@packageQuantity");
  });

  it("com exatamente duas ofertas já há a mais barata, e o empate fica com a primeira", () => {
    const a = { id: "a", price: d(5), packageQuantity: null };
    const b = { id: "b", price: d(4), packageQuantity: null };
    expect(cheapestOffer([a, b])).toBe("b");
    expect(cheapestOffer([b, a])).toBe("b");
    expect(cheapestOffer([a, { ...a, id: "a2" }])).toBe("a");
  });
});

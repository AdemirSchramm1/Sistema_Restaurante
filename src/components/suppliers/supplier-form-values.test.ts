import { describe, it, expect } from "vitest";
import type { Supplier } from "@/domain/suppliers/supplier";
import { d } from "@/domain/shared/decimal";
import { emptySupplierValues, supplierToValues } from "./supplier-form-values";

const supplier = (over: Partial<Supplier>): Supplier => ({
  id: "s1",
  active: true,
  version: 1,
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

describe("valores do formulário do fornecedor", () => {
  it("só o nome: o resto vazio, igual ao formulário novo", () => {
    expect(supplierToValues(supplier({}))).toEqual({ ...emptySupplierValues, name: "Hortifruti do João" });
  });

  it("CNPJ com pontuação, dias como texto, prazo zero e pedido mínimo com 2 casas", () => {
    const v = supplierToValues(
      supplier({
        legalName: "João Hortifruti Ltda",
        cnpj: "11222333000181",
        contactName: "João",
        phone: "(11) 99999-0000",
        email: "joao@exemplo.com",
        deliveryDays: [1, 4],
        leadTimeDays: 0,
        minOrderValue: d("150.5"),
        paymentTerms: "28 dias",
        notes: "Entrega antes das 9h",
      }),
    );
    expect(v).toEqual({
      name: "Hortifruti do João",
      legalName: "João Hortifruti Ltda",
      cnpj: "11.222.333/0001-81",
      contactName: "João",
      phone: "(11) 99999-0000",
      email: "joao@exemplo.com",
      deliveryDays: ["1", "4"],
      leadTimeDays: "0",
      minOrderValue: "150,50",
      paymentTerms: "28 dias",
      notes: "Entrega antes das 9h",
    });
  });
});

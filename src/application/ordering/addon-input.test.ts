import { describe, it, expect } from "vitest";
import { parseAddonForm } from "./addon-input";

const id = "0193a000-0000-7000-8000-000000000010";

describe("formulário do adicional (spec 010, US1)", () => {
  it("lê nome, componente, quantidade e preço com vírgula", () => {
    const r = parseAddonForm({
      name: " Fatia de queijo ",
      component: `ITEM:${id}`,
      quantity: "20",
      unit: "g",
      price: "3,00",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.name).toBe(" Fatia de queijo ");
    expect(r.value.component).toEqual({ kind: "ITEM", id });
    expect(r.value.quantity.toString()).toBe("20");
    expect(r.value.unit).toBe("g");
    expect(r.value.price.toFixed(2)).toBe("3.00");
  });

  it("preço em branco é zero (Grátis)", () => {
    const r = parseAddonForm({ name: "Gelo", component: `ITEM:${id}`, quantity: "1", unit: "un", price: "" });
    expect(r.ok && r.value.price.isZero()).toBe(true);
  });

  it("sem nome no formulário, o nome vem vazio para a regra do domínio recusar", () => {
    const r = parseAddonForm({ component: `ITEM:${id}`, quantity: "1", unit: "un" });
    expect(r.ok && r.value.name).toBe("");
  });

  it("aponta o campo com problema", () => {
    const field = (raw: Record<string, string>) => {
      const r = parseAddonForm({
        name: "A",
        component: `ITEM:${id}`,
        quantity: "1",
        unit: "g",
        price: "1",
        ...raw,
      });
      return r.ok ? "OK" : `${r.error.code}:${r.error.field}`;
    };
    expect(field({ component: "" })).toBe("VALIDATION:component");
    expect(field({ component: "PRATO:x" })).toBe("VALIDATION:component");
    expect(field({ quantity: "abc" })).toBe("INVALID_NUMBER:quantity");
    expect(field({ price: "1,2,3" })).toBe("INVALID_NUMBER:price");
    expect(field({ unit: "xícara" })).toBe("UNKNOWN_UNIT:unit");
  });
});

import { describe, it, expect } from "vitest";
import {
  MAX_ADDON_TIMES,
  defaultRemovalLabel,
  describeChanges,
  priceLine,
  validateChoice,
  validateCustomizationConfig,
  type ProductOptions,
} from "./customization";
import { d } from "../shared/decimal";

const OPTIONS: ProductOptions = {
  addons: [
    { addonId: "queijo", name: "Fatia de queijo", price: d("3.00"), maxTimes: 3, available: true },
    { addonId: "bacon", name: "Bacon", price: d("5.00"), maxTimes: 1, available: true },
    { addonId: "cebola-extra", name: "Cebola extra", price: d("0"), maxTimes: 1, available: true },
    { addonId: "velho", name: "Velho", price: d("1.00"), maxTimes: 1, available: false },
  ],
  removables: [
    { component: { kind: "ITEM", id: "cebola" }, label: "Sem cebola", available: true },
    { component: { kind: "ITEM", id: "picles" }, label: "Sem picles", available: true },
    { component: { kind: "ITEM", id: "alface" }, label: "Sem alface", available: false },
  ],
};
const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? null : r.error!.code);

describe("preço da linha com adicionais (spec 010, FR-004)", () => {
  it("28,00 + 2 × Fatia de queijo 3,00 = 34,00 por unidade", () => {
    const p = priceLine(d("28.00"), OPTIONS, { addons: [{ addonId: "queijo", times: 2 }], removals: [] });
    expect(p.toFixed(2)).toBe("34.00");
  });

  it("tirar não dá desconto e adicional grátis não muda o preço", () => {
    const p = priceLine(d("28.00"), OPTIONS, {
      addons: [{ addonId: "cebola-extra", times: 1 }],
      removals: [{ kind: "ITEM", id: "cebola" }],
    });
    expect(p.toFixed(2)).toBe("28.00");
  });
});

describe("escolha do cliente (spec 010, US3)", () => {
  it("vale: + 2 queijo e sem cebola", () => {
    expect(
      validateChoice(OPTIONS, {
        addons: [{ addonId: "queijo", times: 2 }],
        removals: [{ kind: "ITEM", id: "cebola" }],
      }).ok,
    ).toBe(true);
  });

  it(`vezes de 1 até o máximo do prato (no máximo ${MAX_ADDON_TIMES})`, () => {
    expect(MAX_ADDON_TIMES).toBe(5);
    expect(code(validateChoice(OPTIONS, { addons: [{ addonId: "queijo", times: 4 }], removals: [] }))).toBe(
      "INVALID_ADDON_TIMES",
    );
    expect(code(validateChoice(OPTIONS, { addons: [{ addonId: "queijo", times: 0 }], removals: [] }))).toBe(
      "INVALID_ADDON_TIMES",
    );
  });

  it("adicional não ligado ao prato ou indisponível", () => {
    const r = validateChoice(OPTIONS, { addons: [{ addonId: "velho", times: 1 }, { addonId: "x", times: 1 }], removals: [] });
    expect(r).toEqual({ ok: false, error: { code: "PRODUCT_UNAVAILABLE", details: { addonIds: ["velho", "x"] } } });
  });

  it("retirada que não existe mais no prato", () => {
    const r = validateChoice(OPTIONS, { addons: [], removals: [{ kind: "ITEM", id: "alface" }] });
    expect(code(r)).toBe("OPTION_UNAVAILABLE");
  });

  it("não repete adicional nem retirada", () => {
    expect(
      code(
        validateChoice(OPTIONS, {
          addons: [
            { addonId: "queijo", times: 1 },
            { addonId: "queijo", times: 1 },
          ],
          removals: [],
        }),
      ),
    ).toBe("DUPLICATE_OPTION");
    expect(
      code(
        validateChoice(OPTIONS, {
          addons: [],
          removals: [
            { kind: "ITEM", id: "cebola" },
            { kind: "ITEM", id: "cebola" },
          ],
        }),
      ),
    ).toBe("DUPLICATE_OPTION");
  });
});

describe("texto para a cozinha (spec 010, US4-1)", () => {
  it('"+ 2 Fatia de queijo" e "SEM cebola", na ordem: adicionais e depois retiradas', () => {
    expect(
      describeChanges(
        [
          { name: "Fatia de queijo", times: 2 },
          { name: "Bacon", times: 1 },
        ],
        ["Sem cebola"],
      ),
    ).toEqual(["+ 2 Fatia de queijo", "+ 1 Bacon", "SEM cebola"]);
  });

  it('retirada com texto que não começa com "Sem" ganha o SEM na frente', () => {
    expect(describeChanges([], ["sem Picles", "Molho"])).toEqual(["SEM Picles", "SEM Molho"]);
  });

  it('texto padrão do botão: "Sem" + nome com a primeira letra minúscula', () => {
    expect(defaultRemovalLabel("Cebola roxa")).toBe("Sem cebola roxa");
  });
});

describe('quadro "Adicionar e tirar" do produto (spec 010, US2, FR-002)', () => {
  const inProduct = new Set(["ITEM:cebola", "ITEM:picles", "RECIPE:molho"]);
  const addon = (id: string, maxTimes = 1, active = true) => ({ addonId: id, maxTimes, active });

  it("aceita adicionais ativos com máximo de 1 a 5 e retiradas do próprio produto", () => {
    const r = validateCustomizationConfig(
      {
        addons: [addon("queijo", 3), addon("bacon")],
        removables: [
          { component: { kind: "ITEM", id: "cebola" }, label: null, name: "Cebola" },
          { component: { kind: "RECIPE", id: "molho" }, label: "  Sem molho  ", name: "Molho da casa" },
        ],
      },
      inProduct,
    );
    expect(r.ok && r.value.removables.map((x) => x.label)).toEqual(["Sem cebola", "Sem molho"]);
  });

  it("máximo fora de 1 a 5", () => {
    expect(code(validateCustomizationConfig({ addons: [addon("q", 6)], removables: [] }, inProduct))).toBe(
      "INVALID_MAX_TIMES",
    );
    expect(code(validateCustomizationConfig({ addons: [addon("q", 0)], removables: [] }, inProduct))).toBe(
      "INVALID_MAX_TIMES",
    );
  });

  it("adicional inativo não entra", () => {
    expect(code(validateCustomizationConfig({ addons: [addon("q", 1, false)], removables: [] }, inProduct))).toBe(
      "ADDON_INACTIVE",
    );
  });

  it("só tira o que está no produto, com texto de até 40", () => {
    const out = validateCustomizationConfig(
      { addons: [], removables: [{ component: { kind: "ITEM", id: "tomate" }, label: null, name: "Tomate" }] },
      inProduct,
    );
    expect(code(out)).toBe("NOT_IN_PRODUCT");
    const long = validateCustomizationConfig(
      { addons: [], removables: [{ component: { kind: "ITEM", id: "cebola" }, label: "S".repeat(41), name: "Cebola" }] },
      inProduct,
    );
    expect(code(long)).toBe("INVALID_LABEL");
  });

  it("sem repetir e até 10 de cada", () => {
    expect(
      code(validateCustomizationConfig({ addons: [addon("q"), addon("q")], removables: [] }, inProduct)),
    ).toBe("DUPLICATE_OPTION");
    const eleven = Array.from({ length: 11 }, (_, i) => addon(`a${i}`));
    expect(code(validateCustomizationConfig({ addons: eleven, removables: [] }, inProduct))).toBe("TOO_MANY_OPTIONS");
  });
});

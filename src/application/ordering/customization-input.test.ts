import { describe, it, expect } from "vitest";
import { parseCustomizationForm } from "./customization-input";

const A = "0193a000-0000-7000-8000-0000000000a1";
const C = "0193a000-0000-7000-8000-0000000000c1";

describe("formulário do quadro 'Adicionar e tirar' (spec 010, US2)", () => {
  it("lê as duas listas na ordem da tela", () => {
    const r = parseCustomizationForm({
      "addons.1.addonId": A,
      "addons.1.maxTimes": "2",
      "removables.0.component": `ITEM:${C}`,
      "removables.0.label": "  ",
    });
    expect(r).toEqual({
      ok: true,
      value: {
        addons: [{ addonId: A, maxTimes: 2 }],
        removables: [{ component: { kind: "ITEM", id: C }, label: null }],
      },
    });
  });

  it("recusa chave desconhecida e id inválido", () => {
    expect(parseCustomizationForm({ note: "x" }).ok).toBe(false);
    expect(parseCustomizationForm({ "addons.0.addonId": "1", "addons.0.maxTimes": "1" }).ok).toBe(false);
    expect(parseCustomizationForm({ "removables.0.component": "PRATO:x" }).ok).toBe(false);
  });

  it("aceita o id e a versão do produto; linhas fora de ordem voltam à ordem da tela", () => {
    const B = "0193a000-0000-7000-8000-0000000000b2";
    const r = parseCustomizationForm({
      recipeId: C,
      version: "3",
      "addons.10.addonId": B,
      "addons.10.maxTimes": "1",
      "addons.2.addonId": A,
      "addons.2.maxTimes": "3",
      "removables.1.component": `RECIPE:${C}`,
      "removables.1.label": "Sem molho",
    });
    expect(r).toEqual({
      ok: true,
      value: {
        addons: [
          { addonId: A, maxTimes: 3 },
          { addonId: B, maxTimes: 1 },
        ],
        removables: [{ component: { kind: "RECIPE", id: C }, label: "Sem molho" }],
      },
    });
  });

  it("aponta a linha com problema e lista a chave estranha", () => {
    expect(parseCustomizationForm({ "addons.0.maxTimes": "1" })).toMatchObject({
      ok: false,
      error: { code: "VALIDATION", field: "addons.0" },
    });
    expect(parseCustomizationForm({ "removables.0.label": "Sem sal" })).toMatchObject({
      ok: false,
      error: { code: "VALIDATION", field: "removables.0" },
    });
    expect(parseCustomizationForm({ "addons.0.price": "1" })).toMatchObject({
      ok: false,
      error: { code: "VALIDATION", details: { keys: ["addons.0.price"] } },
    });
  });
});

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
      value: { addons: [{ addonId: A, maxTimes: 2 }], removables: [{ component: { kind: "ITEM", id: C }, label: null }] },
    });
  });

  it("recusa chave desconhecida e id inválido", () => {
    expect(parseCustomizationForm({ note: "x" }).ok).toBe(false);
    expect(parseCustomizationForm({ "addons.0.addonId": "1", "addons.0.maxTimes": "1" }).ok).toBe(false);
    expect(parseCustomizationForm({ "removables.0.component": "PRATO:x" }).ok).toBe(false);
  });
});

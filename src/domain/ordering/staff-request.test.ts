import { describe, expect, it } from "vitest";
import { sameRequest, type StaffRequest } from "./staff-request";

const burger: StaffRequest["lines"][number] = {
  recipeId: "burger",
  quantity: 2,
  addons: [
    { addonId: "queijo", times: 2 },
    { addonId: "bacon", times: 1 },
  ],
  removals: [
    { kind: "ITEM", id: "cebola" },
    { kind: "ITEM", id: "tomate" },
  ],
  kitchenNote: "mal passado",
};
const chope: StaffRequest["lines"][number] = {
  recipeId: "chope",
  quantity: 2,
  addons: [],
  removals: [],
  kitchenNote: null,
};
const stored: StaffRequest = { tableId: "mesa-12", lines: [burger, chope] };

describe("mesmo envio (spec 015, FR-011)", () => {
  it("mesma mesa e mesmas linhas em qualquer ordem é o mesmo envio", () => {
    expect(sameRequest(stored, stored)).toBe(true);
    expect(
      sameRequest(stored, {
        tableId: "mesa-12",
        lines: [
          chope,
          {
            ...burger,
            addons: [...burger.addons].reverse(),
            removals: [...burger.removals].reverse(),
          },
        ],
      }),
    ).toBe(true);
  });

  it("outra mesa, quantidade, adicional, retirada, observação ou linha a mais não é", () => {
    const changed: StaffRequest[] = [
      { ...stored, tableId: "mesa-4" },
      { ...stored, lines: [{ ...burger, quantity: 3 }, chope] },
      { ...stored, lines: [{ ...burger, addons: [{ addonId: "queijo", times: 1 }] }, chope] },
      {
        ...stored,
        lines: [
          {
            ...burger,
            addons: [
              { addonId: "queijo", times: 1 },
              { addonId: "bacon", times: 1 },
            ],
          },
          chope,
        ],
      },
      {
        ...stored,
        lines: [
          {
            ...burger,
            addons: [
              { addonId: "queijo", times: 2 },
              { addonId: "ovo", times: 1 },
            ],
          },
          chope,
        ],
      },
      { ...stored, lines: [{ ...burger, removals: [] }, chope] },
      { ...stored, lines: [{ ...burger, kitchenNote: "ao ponto" }, chope] },
      { ...stored, lines: [burger, chope, chope] },
      { ...stored, lines: [burger] },
    ];
    for (const r of changed) expect(sameRequest(stored, r)).toBe(false);
  });
});

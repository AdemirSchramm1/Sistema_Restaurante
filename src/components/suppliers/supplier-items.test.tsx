// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { SupplierItems, type SupplierItemRow } from "./supplier-items";

afterEach(cleanup);

const noop = async () => null;
const ROWS: SupplierItemRow[] = [
  {
    id: "si1",
    version: 1,
    itemId: "tomate",
    itemName: "Tomate italiano",
    unit: "kg",
    packageLabel: "Caixa",
    packageQuantity: "18",
    price: "90",
    pricePerUnit: "5",
    preferred: true,
    lastPurchase: { date: "01/11/2026", unitCost: "4.9" },
  },
  {
    id: "si2",
    version: 3,
    itemId: "cebola",
    itemName: "Cebola",
    unit: "kg",
    packageLabel: null,
    packageQuantity: null,
    price: "4.5",
    pricePerUnit: "4.5",
    preferred: false,
    lastPurchase: null,
  },
];
const ITEMS = [
  { id: "tomate", label: "Tomate italiano", unit: "kg" as const },
  { id: "alface", label: "Alface", unit: "un" as const },
];

const renderList = (canWrite = true) =>
  render(
    <SupplierItems
      supplierId="s1"
      rows={ROWS}
      items={ITEMS}
      canWrite={canWrite}
      addAction={noop}
      updateAction={noop}
      removeAction={noop}
    />,
  );

describe("itens que o fornecedor vende (spec 007, US2)", () => {
  it("mostra embalagem, preço, preço por medida, última compra e preferido", () => {
    renderList();
    const table = screen.getByRole("table", { name: "Itens que vende" });
    const [first, second] = within(table).getAllByRole("row").slice(1);
    expect(first!.textContent).toContain("Caixa de 18 kg");
    expect(first!.textContent).toContain("R$ 90,00");
    expect(first!.textContent).toContain("R$ 5,00/kg");
    expect(first!.textContent).toContain("01/11/2026: R$ 4,90/kg");
    expect(first!.textContent).toContain("Preferido");
    expect(second!.textContent).toContain("Solto (por kg)");
    expect(second!.textContent).toContain("R$ 4,50/kg");
    expect(second!.textContent).not.toContain("Preferido");
  });

  it("adicionar: item ainda fora da lista, preço e embalagem opcional, com o preço por medida", () => {
    renderList();
    const form = screen.getByRole("form", { name: "Adicionar item ao fornecedor" });
    const item = within(form).getByLabelText("Item") as HTMLSelectElement;
    // Tomate já está na lista: só sobra a alface.
    expect([...item.options].map((o) => o.value).filter(Boolean)).toEqual(["alface"]);
    fireEvent.change(item, { target: { value: "alface" } });
    fireEvent.change(within(form).getByLabelText("Preço (R$)"), { target: { value: "30" } });
    fireEvent.change(within(form).getByLabelText("Embalagem (opcional)"), { target: { value: "Engradado" } });
    fireEvent.change(within(form).getByLabelText("Quanto vem (un)"), { target: { value: "12" } });
    expect(within(form).getByTestId("supplier-item-unit-price").textContent).toBe("= R$ 2,50/un");
  });

  it("quem só consulta não vê adicionar, editar nem tirar", () => {
    renderList(false);
    expect(screen.queryByRole("form", { name: "Adicionar item ao fornecedor" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Tirar/ })).toBeNull();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

  it("sem itens: avisa nos dois modos, com a coluna de mudar só para quem cadastra", () => {
    for (const canWrite of [true, false]) {
      render(
        <SupplierItems
          supplierId="s1"
          rows={[]}
          items={ITEMS}
          canWrite={canWrite}
          addAction={noop}
          updateAction={noop}
          removeAction={noop}
        />,
      );
      const cell = screen.getByText("Nenhum item ainda.") as HTMLTableCellElement;
      expect(cell.colSpan).toBe(canWrite ? 6 : 5);
      cleanup();
    }
  });

  const fail = (field?: string) => ({
    ok: false as const,
    error: { code: "VALIDATION" as const, field, message: field ? `Erro em ${field}.` : "Erro geral." },
    at: 1,
  });

  async function submitAdd(action: () => Promise<unknown>) {
    render(
      <SupplierItems
        supplierId="s1"
        rows={ROWS}
        items={ITEMS}
        canWrite
        addAction={action as never}
        updateAction={noop}
        removeAction={noop}
      />,
    );
    const form = screen.getByRole("form", { name: "Adicionar item ao fornecedor" });
    await act(async () => {
      fireEvent.submit(form);
    });
    return form;
  }

  it("adicionar: erro geral em cima, erro de campo embaixo, e sucesso limpa os campos", async () => {
    let form = await submitAdd(async () => fail());
    expect(within(form).getAllByText("Erro geral.").length).toBeGreaterThan(0);
    cleanup();

    form = await submitAdd(async () => fail("price"));
    expect(within(form).getAllByText("Erro em price.").length).toBeGreaterThan(0);
    cleanup();

    form = await submitAdd(async () => ({ ok: true, data: null, at: 7 }));
    expect((within(form).getByLabelText("Preço (R$)") as HTMLInputElement).value).toBe("");
    expect(within(form).queryByRole("alert")).toBeNull();
  });

  it("editar: salvo avisa; recusa mostra a mensagem", async () => {
    const results = [fail("price"), { ok: true as const, data: null, at: 2 }];
    render(
      <SupplierItems
        supplierId="s1"
        rows={ROWS}
        items={ITEMS}
        canWrite
        addAction={noop}
        updateAction={async () => results.shift()!}
        removeAction={noop}
      />,
    );
    const form = screen.getByRole("form", { name: "Editar Cebola" });
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(within(form).getAllByText("Erro em price.").length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(within(form).getByRole("status").textContent).toBe("Salvo.");
  });
});

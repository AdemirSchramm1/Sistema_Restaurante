// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { MovementView } from "@/application/inventory/movements";
import { d } from "@/domain/shared/decimal";

vi.mock("@/actions/movements", () => ({ reverseMovementAction: async () => null }));
const { MovementTable } = await import("./movement-table");

afterEach(cleanup);

const row = (over: Partial<MovementView>): MovementView => ({
  id: "m1",
  type: "PURCHASE",
  itemId: "queijo",
  itemName: "Queijo prato",
  stockUnit: "kg",
  quantity: d("1"),
  enteredQuantity: d("1"),
  enteredUnit: "kg",
  unitCost: d("50"),
  totalCost: d("50"),
  reasonId: null,
  reasonLabel: null,
  notes: null,
  occurredAt: new Date("2026-11-11T20:00:00Z"),
  recordedAt: new Date("2026-11-11T20:00:00Z"),
  recordedBy: "u1",
  recordedByName: "Chef Ana",
  approvedBy: null,
  approvedByName: null,
  reversesId: null,
  reversedById: null,
  supplierId: null,
  supplierName: null,
  order: null,
  ...over,
});

const sale = row({
  id: "venda",
  type: "SALE_RECIPE",
  quantity: d("-0.14"),
  enteredQuantity: d("0.14"),
  unitCost: d("50"),
  totalCost: d("-7"),
  order: { id: "o7", number: 7, tableName: "12" },
});

describe("lançamentos com a venda pelo pedido (spec 011, US4)", () => {
  it("venda mostra o pedido e a mesa", () => {
    render(<MovementTable rows={[sale]} timezone="America/Sao_Paulo" canReverse={false} />);
    const cells = within(screen.getAllByRole("row")[1]!).getAllByRole("cell");
    expect(cells.map((c) => c.textContent)).toEqual(
      expect.arrayContaining(["Venda ", "-0,14 kg", "R$ -7,00", "Pedido 7, Mesa 12"]),
    );
  });

  it("venda sem custo diz 'Sem custo'", () => {
    render(
      <MovementTable
        rows={[{ ...sale, unitCost: d(0), totalCost: d(0) }]}
        timezone="America/Sao_Paulo"
        canReverse={false}
      />,
    );
    expect(screen.getByText("Sem custo")).toBeTruthy();
  });

  it("perda do cancelamento mostra o motivo e o pedido", () => {
    const loss = row({
      id: "perda",
      type: "LOSS",
      quantity: d("-0.14"),
      totalCost: d("-7"),
      reasonId: "x",
      reasonLabel: "Pedido cancelado",
      order: { id: "o7", number: 7, tableName: "12" },
    });
    render(<MovementTable rows={[loss]} timezone="America/Sao_Paulo" canReverse={false} />);
    expect(screen.getByText("Pedido cancelado · pedido 7, Mesa 12")).toBeTruthy();
  });

  it("venda não tem 'Estornar' (desfaz cancelando o pedido); compra tem, sem os motivos do sistema", () => {
    render(<MovementTable rows={[sale, row({ id: "compra" })]} timezone="America/Sao_Paulo" canReverse />);
    const buttons = screen.getAllByRole("button", { name: "Estornar" });
    expect(buttons).toHaveLength(1);
    const options = within(screen.getByLabelText("Motivo do estorno"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toEqual(["Motivo…", "Lançado errado", "Lançado em dobro", "Outro"]);
  });
});

describe("lista de lançamentos: cada coluna (spec 018, US2 e R4)", () => {
  const cells = (id: string) =>
    within(screen.getByText(`linha ${id}`).closest("tr")!)
      .getAllByRole("cell")
      .map((c) => c.textContent);

  it("motivo, fornecedor, medida digitada, observação, aprovação e estornado", () => {
    render(
      <MovementTable
        timezone="America/Sao_Paulo"
        canReverse
        rows={[
          row({
            id: "perda",
            type: "LOSS",
            quantity: d("-0.5"),
            enteredQuantity: d("500"),
            enteredUnit: "g",
            reasonLabel: "Queimou",
            notes: "linha perda",
            reversedById: "x",
          }),
          row({ id: "compra", supplierName: "Laticínios Sul", notes: "linha compra", recordedByName: null }),
          row({
            id: "acerto",
            type: "ADJUSTMENT",
            quantity: d("-2"),
            enteredQuantity: d("-2"),
            reasonLabel: "Conferi na prateleira",
            notes: "linha acerto",
            approvedByName: "Gerente Gil",
          }),
          row({ id: "solto", notes: "linha solto" }),
          row({
            id: "excecao",
            type: "ADJUSTMENT",
            notes: "linha excecao",
            approvedBy: "u1",
            approvedByName: "Chef Ana",
          }),
        ]}
      />,
    );
    expect(cells("perda")).toEqual([
      "11/11/2026",
      "Queijo prato",
      "Perda estornado",
      "-0,5 kg (500 g)",
      "R$ 50,00",
      "Queimoulinha perda",
      "Chef Ana",
      "",
    ]);
    expect(cells("compra").slice(5, 7)).toEqual(["De Laticínios Sullinha compra", "—"]);
    expect(cells("acerto").slice(3, 7)).toEqual([
      "-2 kg",
      "R$ 50,00",
      "Conferi na prateleiralinha acerto",
      "Chef Anaaprovado por Gerente Gil",
    ]);
    expect(cells("solto")[5]).toBe("—linha solto");
    // Operação pequena (spec 019, US2): quem pediu aprovou.
    expect(cells("excecao")[6]).toBe("Chef AnaAprovado por quem pediu (operação pequena)");
  });

  it("sem lançamentos diz isso; sem a coluna do item quando a lista é de um item só", () => {
    render(<MovementTable timezone="America/Sao_Paulo" canReverse={false} showItem={false} rows={[]} />);
    expect(screen.getByText("Nenhum lançamento ainda.")).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Item" })).toBeNull();
  });
});

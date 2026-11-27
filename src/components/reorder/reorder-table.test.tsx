// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ReorderTable } from "./reorder-table";
import type { ReorderAlert } from "@/application/inventory/reorder";
import { d } from "@/domain/shared/decimal";

afterEach(cleanup);

const alert = (over: Partial<ReorderAlert> = {}): ReorderAlert => ({
  itemId: "tomate",
  code: "01.01.0001",
  name: "Tomate",
  unit: "kg",
  balance: d(15),
  reorderPoint: d(20),
  parLevel: d(50),
  averageDailyUsage: d("1.5"),
  order: { quantity: d("36.5"), packages: { count: d(2), label: "Caixa", total: d(40) } },
  supplier: { name: "Hortifruti do João", phone: "(11) 99999-0000", leadTimeDays: 1 },
  ...over,
});
const row = (name: string) =>
  screen.getByRole("table", { name: "Itens para repor" }).querySelector(`tr[data-item="${name}"]`)!;

describe("tabela Repor (spec 006, US2)", () => {
  it("mostra saldo, ponto, quanto comprar em caixas e o contato do fornecedor", () => {
    render(<ReorderTable rows={[alert()]} />);
    const r = row("tomate");
    expect(r.textContent).toContain("15 kg");
    expect(r.textContent).toContain("20 kg");
    expect(r.textContent).toContain("2 Caixas (40 kg)");
    expect(r.textContent).toContain("Hortifruti do João");
    expect(r.textContent).toContain("(11) 99999-0000");
    expect(r.textContent).toContain("entrega em 1 dia");
    expect(
      within(r as HTMLElement)
        .getByRole("link", { name: "Tomate" })
        .getAttribute("href"),
    ).toBe("/estoque/itens/tomate");
  });

  it("uma embalagem fica no singular e embalagem já no plural não ganha outro s", () => {
    render(
      <ReorderTable
        rows={[
          alert({
            itemId: "a",
            order: { quantity: d(5), packages: { count: d(1), label: "Caixa", total: d(20) } },
          }),
          alert({
            itemId: "b",
            order: { quantity: d(5), packages: { count: d(3), label: "Pães", total: d(3) } },
          }),
        ]}
      />,
    );
    expect(row("a").textContent).toContain("1 Caixa (20 kg)");
    expect(row("b").textContent).toContain("3 Pães (3 kg)");
  });

  it("sem embalagem, sem comprar até e nada a comprar", () => {
    render(
      <ReorderTable
        rows={[
          alert({ itemId: "solto", order: { quantity: d("8.5"), packages: null } }),
          alert({ itemId: "sem-par", parLevel: null, order: { quantity: null, packages: null } }),
          alert({ itemId: "zero", order: { quantity: d(0), packages: null } }),
        ]}
      />,
    );
    expect(row("solto").textContent).toContain("8,5 kg");
    expect(row("sem-par").textContent).toContain('Defina "Comprar até" no item');
    expect(row("zero").textContent).toContain("Nada por enquanto");
  });

  it("item que acabou ganha o selo e item sem fornecedor diz isso", () => {
    render(<ReorderTable rows={[alert({ balance: d(0), supplier: null })]} />);
    expect(row("tomate").textContent).toContain("acabou");
    expect(row("tomate").textContent).toContain("Sem fornecedor preferido");
  });

  it("sem itens no ponto mostra a mensagem de tudo certo", () => {
    render(<ReorderTable rows={[]} />);
    expect(screen.getByText("Nenhum item precisa de reposição agora.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("tabela Repor: prazo de entrega (spec 018, R4)", () => {
  it("1 dia no singular, mais de um no plural; sem prazo não diz nada", () => {
    render(
      <ReorderTable
        rows={[
          alert({ itemId: "a", supplier: { name: "A", phone: null, leadTimeDays: 1 } }),
          alert({ itemId: "b", supplier: { name: "B", phone: null, leadTimeDays: 3 } }),
          alert({ itemId: "c", supplier: { name: "C", phone: null, leadTimeDays: null } }),
        ]}
      />,
    );
    expect(row("a").textContent).toContain("entrega em 1 dia");
    expect(row("b").textContent).toContain("entrega em 3 dias");
    expect(row("c").textContent).not.toContain("entrega em");
  });
});

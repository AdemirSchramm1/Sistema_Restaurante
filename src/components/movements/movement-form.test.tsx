// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { act, cleanup, render, screen, fireEvent } from "@testing-library/react";
import { MovementForm, type MovementItemOption } from "./movement-form";

afterEach(cleanup);

const ITEMS: MovementItemOption[] = [
  { id: "tomate", label: "Tomate", unit: "kg", packageLabel: "Caixa", packageFactor: "20", balance: "10" },
  { id: "ovo", label: "Ovo", unit: "un", packageLabel: null, packageFactor: null, balance: "30" },
];
const noop = async () => null;
const renderForm = (over: Partial<Parameters<typeof MovementForm>[0]> = {}) =>
  render(
    <MovementForm
      action={noop}
      items={ITEMS}
      types={["PURCHASE", "LOSS", "ADJUSTMENT"]}
      today="2026-11-02"
      {...over}
    />,
  );

const values = (el: HTMLElement) =>
  [...(el as HTMLSelectElement).options].map((o) => o.value).filter(Boolean);

describe("formulário de lançamento (spec 004)", () => {
  it("compra pede item, quantidade, valor pago e data; sem motivo", () => {
    renderForm();
    for (const l of ["Item", "Quantidade", "Valor total pago (R$)", "Data"])
      expect(screen.getByLabelText(l), l).toBeTruthy();
    expect(screen.queryByLabelText("Motivo")).toBeNull();
  });

  it("item com embalagem permite lançar em caixas e mostra quanto vai entrar", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Item"), { target: { value: "tomate" } });
    expect(values(screen.getByLabelText("Medida"))).toEqual(["g", "kg", "PACKAGE"]);
    fireEvent.change(screen.getByLabelText("Medida"), { target: { value: "PACKAGE" } });
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "3" } });
    expect(screen.getByTestId("movement-preview").textContent).toBe("Vai entrar: 60 kg");
    fireEvent.change(screen.getByLabelText("Valor total pago (R$)"), { target: { value: "240" } });
    expect(screen.getByTestId("movement-unit-cost").textContent).toBe("R$ 4,00 por kg");
  });

  it("perda pede motivo da lista e mostra o saldo", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Tipo de lançamento"), { target: { value: "LOSS" } });
    fireEvent.change(screen.getByLabelText("Item"), { target: { value: "tomate" } });
    expect(screen.getByLabelText("Motivo")).toBeTruthy();
    expect(screen.queryByLabelText("Valor total pago (R$)")).toBeNull();
    expect(values(screen.getByLabelText("Medida"))).toEqual(["g", "kg"]);
    expect(screen.getByTestId("movement-balance").textContent).toBe("Em estoque: 10 kg");
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Medida"), { target: { value: "g" } });
    expect(screen.getByTestId("movement-preview").textContent).toBe("Vai sair: 0,5 kg");
  });

  it("perda não oferece 'Pedido cancelado': só o cancelamento do pedido usa (spec 011)", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Tipo de lançamento"), { target: { value: "LOSS" } });
    const labels = [...(screen.getByLabelText("Motivo") as HTMLSelectElement).options].map(
      (o) => o.textContent,
    );
    expect(labels).toContain("Queimou");
    expect(labels).not.toContain("Pedido cancelado");
  });

  it("acerto pergunta quanto tem de verdade e avisa que precisa de aprovação", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Tipo de lançamento"), { target: { value: "ADJUSTMENT" } });
    fireEvent.change(screen.getByLabelText("Item"), { target: { value: "tomate" } });
    fireEvent.change(screen.getByLabelText("Quanto tem de verdade"), { target: { value: "8" } });
    expect(screen.getByTestId("movement-preview").textContent).toBe("Diferença: −2 kg (faltam)");
    expect(screen.getByText(/outro gerente precisa aprovar/i)).toBeTruthy();
  });

  it("só mostra os tipos que a pessoa pode lançar", () => {
    renderForm({ types: ["LOSS", "ADJUSTMENT"] });
    expect(values(screen.getByLabelText("Tipo de lançamento"))).toEqual(["LOSS", "ADJUSTMENT"]);
  });

  it("depois de erro do servidor mantém o digitado e mostra o erro no campo", async () => {
    const failing = async () => ({
      ok: false as const,
      error: { code: "INSUFFICIENT_STOCK" as const, field: "quantity", message: "Só há 10 kg." },
      at: 1,
    });
    renderForm({ action: failing });
    fireEvent.change(screen.getByLabelText("Tipo de lançamento"), { target: { value: "LOSS" } });
    fireEvent.change(screen.getByLabelText("Item"), { target: { value: "tomate" } });
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "50" } });
    await act(async () => {
      fireEvent.submit(screen.getByRole("form", { name: "Lançamento" }));
    });
    expect((await screen.findAllByText("Só há 10 kg.")).length).toBeGreaterThan(0);
    expect((screen.getByLabelText("Quantidade") as HTMLInputElement).value).toBe("50");
    expect(screen.getByLabelText("Quantidade").getAttribute("aria-invalid")).toBe("true");
  });
});

describe("fornecedor na compra (spec 007, US4)", () => {
  const SUPPLIERS = [
    {
      id: "s1",
      name: "Hortifruti do João",
      packages: [{ itemId: "tomate", packageLabel: "Caixa", packageQuantity: "18" }],
    },
    { id: "s2", name: "Mercado", packages: [] },
  ];

  it("compra tem o campo Fornecedor (opcional); perda não", () => {
    renderForm({ suppliers: SUPPLIERS });
    const select = screen.getByLabelText("Fornecedor (opcional)") as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual([
      "Sem fornecedor",
      "Hortifruti do João",
      "Mercado",
    ]);
    fireEvent.change(screen.getByLabelText("Tipo de lançamento"), { target: { value: "LOSS" } });
    expect(screen.queryByLabelText("Fornecedor (opcional)")).toBeNull();
  });

  it("fornecedor com caixa própria acrescenta a medida e calcula quanto entra", () => {
    renderForm({ suppliers: SUPPLIERS });
    fireEvent.change(screen.getByLabelText("Item"), { target: { value: "tomate" } });
    fireEvent.change(screen.getByLabelText("Fornecedor (opcional)"), { target: { value: "s1" } });
    const unit = screen.getByLabelText("Medida") as HTMLSelectElement;
    expect(values(unit)).toEqual(["g", "kg", "PACKAGE", "SUPPLIER_PACKAGE"]);
    expect([...unit.options].at(-1)!.textContent).toBe("Caixa do fornecedor (18 kg)");
    fireEvent.change(unit, { target: { value: "SUPPLIER_PACKAGE" } });
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "2" } });
    expect(screen.getByTestId("movement-preview").textContent).toBe("Vai entrar: 36 kg");

    fireEvent.change(screen.getByLabelText("Fornecedor (opcional)"), { target: { value: "s2" } });
    expect(values(screen.getByLabelText("Medida"))).toEqual(["g", "kg", "PACKAGE"]);
  });
});

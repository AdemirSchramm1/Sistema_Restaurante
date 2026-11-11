// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ActionState } from "@/actions/_session";
import { KitchenBoard, type KitchenOrderView } from "./kitchen-board";

afterEach(cleanup);

const noop = async () => null;
const order = (over: Partial<KitchenOrderView>): KitchenOrderView => ({
  id: "o1",
  number: 1,
  tableName: "12",
  submittedAt: "2026-11-08T20:00:00.000Z",
  status: "RECEIVED",
  late: false,
  version: 1,
  lines: [{ quantity: 2, productName: "X-Burger", changes: ["+ 2 Fatia de queijo", "SEM cebola"] }],
  ...over,
});
const props = { serverNow: "2026-11-08T20:05:00.000Z", advance: noop, cancel: noop };

describe("quadro da cozinha (spec 009 US4)", () => {
  it("mostra mesa, número, há quanto tempo e as mudanças embaixo do produto", () => {
    render(<KitchenBoard {...props} orders={[order({})]} />);
    const card = screen.getByRole("article", { name: "Pedido 1, Mesa 12" });
    expect(within(card).getByText("Mesa 12")).toBeTruthy();
    expect(within(card).getByText("há 5 min")).toBeTruthy();
    expect(within(card).getByText("2 × X-Burger")).toBeTruthy();
    expect(
      within(card)
        .getAllByRole("listitem")
        .some((li) => li.textContent === "SEM cebola"),
    ).toBe(true);
  });

  it("botão de cada situação", () => {
    render(
      <KitchenBoard
        {...props}
        orders={[
          order({}),
          order({ id: "o2", number: 2, status: "PREPARING" }),
          order({ id: "o3", number: 3, status: "READY" }),
        ]}
      />,
    );
    const card = (n: number) => screen.getByRole("article", { name: `Pedido ${n}, Mesa 12` });
    expect(within(card(1)).getByRole("button", { name: "Começar preparo" })).toBeTruthy();
    expect(within(card(2)).getByRole("button", { name: "Pronto" })).toBeTruthy();
    expect(within(card(3)).queryByRole("button", { name: "Pronto" })).toBeNull();
    const ready = screen.getByRole("article", { name: "Pedido 3, Mesa 12" });
    expect(within(ready).getByText("Esperando o garçom")).toBeTruthy();
  });

  it("'Atrasado' em texto, não só em cor", () => {
    render(<KitchenBoard {...props} orders={[order({ late: true })]} />);
    expect(screen.getByText("Atrasado")).toBeTruthy();
  });

  it("pedido que chega depois aparece como 'Novo'", () => {
    const { rerender } = render(<KitchenBoard {...props} orders={[order({})]} />);
    expect(screen.queryByText("Novo")).toBeNull();
    rerender(<KitchenBoard {...props} orders={[order({}), order({ id: "o2", number: 2 })]} />);
    const card = screen.getByRole("article", { name: "Pedido 2, Mesa 12" });
    expect(within(card).getByText("Novo")).toBeTruthy();
    expect(within(screen.getByRole("article", { name: "Pedido 1, Mesa 12" })).queryByText("Novo")).toBeNull();
  });

  it("cancelar pede o motivo; 'Outro' pede o texto", () => {
    render(<KitchenBoard {...props} orders={[order({})]} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar pedido 1" }));
    const reason = screen.getByLabelText("Motivo") as HTMLSelectElement;
    expect(Array.from(reason.options).map((o) => o.text)).toEqual([
      "Escolha",
      "Cliente desistiu",
      "Produto acabou",
      "Pedido indevido",
      "Outro",
    ]);
    expect(screen.queryByLabelText("Qual o motivo?")).toBeNull();
    fireEvent.change(reason, { target: { value: "OTHER" } });
    expect(screen.getByLabelText("Qual o motivo?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirmar cancelamento" })).toBeTruthy();
  });

  it("cancelar pedido em preparo ou pronto pergunta se os ingredientes já foram usados (padrão Sim)", async () => {
    const calls: Record<string, string>[] = [];
    const cancel = async (_p: ActionState, form: FormData): Promise<ActionState> => {
      calls.push(Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])));
      return { ok: true, data: null, at: 1 };
    };
    render(
      <KitchenBoard
        {...props}
        cancel={cancel}
        orders={[order({ status: "PREPARING", version: 2 }), order({ id: "o3", number: 3, status: "READY" })]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar pedido 1" }));
    const question = screen.getByRole("group", { name: "Os ingredientes já foram usados?" });
    expect((within(question).getByRole("radio", { name: "Sim, vão para a perda" }) as HTMLInputElement).checked).toBe(
      true,
    );
    expect(within(question).getByRole("radio", { name: "Não, voltam para o estoque" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "CUSTOMER_GAVE_UP" } });
    fireEvent.click(within(question).getByRole("radio", { name: "Não, voltam para o estoque" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
    });
    expect(calls).toEqual([{ id: "o1", version: "2", reason: "CUSTOMER_GAVE_UP", ingredientsUsed: "false" }]);

    fireEvent.click(screen.getByRole("button", { name: "Cancelar pedido 3" }));
    expect(screen.getByRole("group", { name: "Os ingredientes já foram usados?" })).toBeTruthy();
  });

  it("pedido só recebido não pergunta pelos ingredientes", () => {
    render(<KitchenBoard {...props} orders={[order({})]} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar pedido 1" }));
    expect(screen.queryByRole("group", { name: "Os ingredientes já foram usados?" })).toBeNull();
  });
});

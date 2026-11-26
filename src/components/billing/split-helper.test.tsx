// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SplitHelper } from "./split-helper";

afterEach(cleanup);

const people = (n: string) =>
  fireEvent.change(screen.getByLabelText("Dividir por quantas pessoas?"), { target: { value: n } });
const parts = () => screen.queryAllByRole("listitem").map((li) => li.querySelector("span")?.textContent);

function setup(remaining = "100.00") {
  const picked: string[] = [];
  const view = render(<SplitHelper remaining={remaining} onPick={(a) => picked.push(a)} />);
  const rerender = (r: string) => view.rerender(<SplitHelper remaining={r} onPick={(a) => picked.push(a)} />);
  return { picked, rerender };
}

describe("dividir a conta (spec 011, US3)", () => {
  it("dividir por 3: os centavos que sobram vão para a primeira parte", () => {
    setup();
    people("3");
    expect(parts()).toEqual(["Parte 1 de 3: R$ 33,34", "Parte 2 de 3: R$ 33,33", "Parte 3 de 3: R$ 33,33"]);
  });

  it("'Pagar parte 1 de 3' preenche o valor do pagamento", () => {
    const s = setup();
    people("3");
    fireEvent.click(screen.getByRole("button", { name: "Pagar parte 1 de 3" }));
    expect(s.picked).toEqual(["33.34"]);
  });

  it("depois que a parte é paga, as outras são refeitas sobre o que falta", () => {
    const s = setup();
    people("3");
    fireEvent.click(screen.getByRole("button", { name: "Pagar parte 1 de 3" }));
    s.rerender("66.66");
    expect(parts()).toEqual(["Parte 2 de 3: R$ 33,33", "Parte 3 de 3: R$ 33,33"]);
    fireEvent.click(screen.getByRole("button", { name: "Pagar parte 2 de 3" }));
    s.rerender("33.33");
    expect(parts()).toEqual(["Parte 3 de 3: R$ 33,33"]);
  });

  it("valor livre antes de dividir: a divisão é feita sobre o que falta", () => {
    const s = setup();
    s.rerender("50.00");
    people("3");
    expect(parts()).toEqual(["Parte 1 de 3: R$ 16,68", "Parte 2 de 3: R$ 16,66", "Parte 3 de 3: R$ 16,66"]);
  });

  it("mudar o número de pessoas no meio refaz as partes sobre o que falta", () => {
    const s = setup();
    people("3");
    fireEvent.click(screen.getByRole("button", { name: "Pagar parte 1 de 3" }));
    s.rerender("66.66");
    people("2");
    expect(parts()).toEqual(["Parte 1 de 2: R$ 33,33", "Parte 2 de 2: R$ 33,33"]);
  });

  it("2 a 20 pessoas", () => {
    setup();
    people("1");
    expect(screen.getByText("Divida por 2 a 20 pessoas.")).toBeTruthy();
    expect(parts()).toEqual([]);
    people("21");
    expect(screen.getByText("Divida por 2 a 20 pessoas.")).toBeTruthy();
  });

  it("sem número de pessoas, só o lembrete do valor livre", () => {
    setup();
    expect(parts()).toEqual([]);
    expect(screen.getByText("Ou digite qualquer valor no pagamento.")).toBeTruthy();
  });

  it("falta que não é dinheiro válido (mais de 2 casas) não oferece partes (spec 018)", () => {
    setup("10.005");
    people("3");
    expect(parts()).toEqual([]);
  });
});

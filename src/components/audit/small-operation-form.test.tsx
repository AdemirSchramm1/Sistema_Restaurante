// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SmallOperationForm } from "./small-operation-form";

afterEach(cleanup);

const action = async () => null;
const hidden = (name: string) =>
  (document.querySelector(`input[type=hidden][name=${name}]`) as HTMLInputElement | null)?.value;

describe("Operação pequena (spec 019, US2)", () => {
  it("desligado: explica o modo e pede confirmação para ligar", () => {
    render(<SmallOperationForm enabled={false} version={3} action={action} />);
    expect(screen.getByText("Desligado")).toBeTruthy();
    expect(
      screen.getByText(
        "Com o modo ligado, o gerente pode aprovar o próprio acerto de estoque. Cada caso fica marcado como exceção e entra na revisão da semana.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirmar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ligar o modo" }));
    expect(screen.getByText("Ligar o modo operação pequena?")).toBeTruthy();
    expect(hidden("enabled")).toBe("true");
    expect(hidden("version")).toBe("3");
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.queryByRole("button", { name: "Confirmar" })).toBeNull();
    expect(screen.getByRole("button", { name: "Ligar o modo" })).toBeTruthy();
  });

  it("ligado: pede confirmação para desligar e avisa o que acontece com os pendentes", () => {
    render(<SmallOperationForm enabled version={7} action={action} />);
    expect(screen.getByText("Ligado")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Desligar o modo" }));
    expect(
      screen.getByText(
        "Desligar o modo operação pequena? As exceções já aprovadas continuam; os pedidos pendentes voltam a precisar de outro gerente.",
      ),
    ).toBeTruthy();
    expect(hidden("enabled")).toBe("false");
    expect(hidden("version")).toBe("7");
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeTruthy();
  });
});

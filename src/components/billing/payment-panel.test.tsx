// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PaymentPanel } from "./payment-panel";

afterEach(cleanup);

const amount = () => (screen.getByLabelText("Valor (R$)") as HTMLInputElement).value;
const pick = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

describe("receber com divisão (spec 011, US2 e US3)", () => {
  it("o valor começa com o que falta; cada parte escolhida preenche o pagamento, mesmo repetida", () => {
    render(<PaymentPanel tabId="t1" remaining="100.00" action={async () => null} />);
    expect(amount()).toBe("100,00");
    fireEvent.change(screen.getByLabelText("Dividir por quantas pessoas?"), { target: { value: "3" } });
    pick("Pagar parte 2 de 3");
    expect(amount()).toBe("33,33");
    fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: "10,00" } });
    pick("Pagar parte 2 de 3");
    expect(amount()).toBe("33,33");
    pick("Pagar parte 1 de 3");
    expect(amount()).toBe("33,34");
  });
});

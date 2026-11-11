// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { StockBalance } from "./stock-balance";
import { d } from "@/domain/shared/decimal";

afterEach(cleanup);

describe("saldo do item (spec 004; saldo negativo pela venda na spec 011)", () => {
  it("mostra o saldo na medida do item", () => {
    render(<StockBalance balance={d("0.86")} unit="kg" />);
    expect(screen.getByTestId("item-balance").textContent).toBe("Em estoque: 0,86 kg");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("saldo negativo vem com o aviso em texto, não só em cor", () => {
    render(<StockBalance balance={d("-0.2")} unit="kg" />);
    expect(screen.getByTestId("item-balance").textContent).toBe("Em estoque: -0,2 kg");
    expect(screen.getByRole("alert").textContent).toBe(
      "O estoque está menor que o que o sistema esperava. Lance a compra que faltou ou peça um acerto.",
    );
  });
});

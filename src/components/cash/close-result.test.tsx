// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { actionSpy, clickButton, refusal, typeIn, valueOf } from "@/components/forms/testing";
import { CloseResult, type CloseResultView } from "./close-result";

afterEach(cleanup);

const short: CloseResultView = {
  sessionId: "s1",
  counted: "125.00",
  expected: "127.00",
  difference: "-2.00",
  result: "SHORT",
  counts: ["125.00"],
  openTabs: 0,
};
const balanced: CloseResultView = { ...short, counted: "127.00", difference: "0.00", result: "BALANCED" };
const NOTE = /^Observação/;
const KEPT = "Fica na gaveta (R$)";
const show = (closing: CloseResultView, result = actionSpy()) => {
  render(<CloseResult closing={closing} action={result.action} />);
  return result;
};
const note = () => screen.getByLabelText(NOTE) as HTMLInputElement;

describe("resultado da contagem e fechamento (spec 014, US4-3 a US4-6)", () => {
  it("Bateu: mostra o esperado e o contado; a observação é opcional", () => {
    show(balanced);
    expect(screen.getByText("Bateu")).toBeTruthy();
    expect(screen.getByText("Esperado na gaveta").nextElementSibling?.textContent).toBe("R$ 127,00");
    expect(screen.getByText("Contado").nextElementSibling?.textContent).toBe("R$ 127,00");
    expect(note().required).toBe(false);
  });

  it("Falta e Sobra: com diferença a observação é obrigatória", () => {
    show(short);
    expect(screen.getByText("Falta R$ 2,00")).toBeTruthy();
    expect(note().required).toBe(true);
    cleanup();
    show({ ...short, counted: "130.00", difference: "3.00", result: "OVER" });
    expect(screen.getByText("Sobra R$ 3,00")).toBeTruthy();
    expect(note().required).toBe(true);
  });

  it("Fica na gaveta vem com o contado e mostra a retirada do fechamento (US4-4)", () => {
    show(short);
    expect(valueOf(KEPT)).toBe("125,00");
    expect(screen.getByText("Retirada do fechamento: R$ 0,00")).toBeTruthy();
    typeIn(KEPT, "100,00");
    expect(screen.getByText("Retirada do fechamento: R$ 25,00")).toBeTruthy();
    typeIn(KEPT, "130,00");
    expect(screen.getByText("O que fica na gaveta não pode passar do que foi contado.")).toBeTruthy();
    typeIn(KEPT, "abc");
    expect(screen.queryByText(/Retirada do fechamento/)).toBeNull();
  });

  it("Contar de novo volta à contagem; as contagens feitas aparecem em ordem (US4-2)", () => {
    show({ ...short, counts: ["120.00", "125.00"] });
    expect(screen.getByRole("link", { name: "Contar de novo" }).getAttribute("href")).toBe(
      "/caixa/fechar?recontar=1",
    );
    expect(screen.getByText("1ª contagem R$ 120,00 · 2ª contagem R$ 125,00")).toBeTruthy();
  });

  it("avisa das mesas com conta aberta, sem segurar o fechamento (US4-5)", () => {
    show({ ...short, openTabs: 3 });
    expect(
      screen.getByText("3 mesas ainda têm conta aberta. Os pagamentos delas vão entrar no próximo turno."),
    ).toBeTruthy();
    cleanup();
    show(short);
    expect(screen.queryByText(/conta aberta/)).toBeNull();
  });

  it("Fechar caixa envia o turno, o que fica e a observação", async () => {
    const s = show(short);
    typeIn(KEPT, "100,00");
    typeIn(NOTE, "Troco errado na mesa 4");
    await clickButton("Fechar caixa");
    expect(s.calls).toEqual([{ sessionId: "s1", kept: "100,00", note: "Troco errado na mesa 4" }]);
  });

  it("recusa por dinheiro que entrou depois da contagem mostra o texto e o caminho para contar de novo", async () => {
    show(
      short,
      actionSpy(refusal("COUNT_OUTDATED", "Entrou dinheiro no turno depois da contagem. Conte de novo.")),
    );
    typeIn(NOTE, "x");
    await clickButton("Fechar caixa");
    expect(screen.getByRole("alert").textContent).toBe(
      "Entrou dinheiro no turno depois da contagem. Conte de novo.",
    );
    expect(screen.getByRole("link", { name: "Contar de novo" })).toBeTruthy();
    expect(note().value).toBe("x");
  });
});

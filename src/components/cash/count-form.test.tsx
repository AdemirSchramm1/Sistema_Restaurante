// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { actionSpy, clickButton, refusal, typeIn, valueOf } from "@/components/forms/testing";
import { CountForm } from "./count-form";

afterEach(cleanup);

const TOTAL = "Dinheiro contado na gaveta (R$)";
const LABELS = [
  "R$ 200",
  "R$ 100",
  "R$ 50",
  "R$ 20",
  "R$ 10",
  "R$ 5",
  "R$ 2",
  "R$ 1",
  "R$ 0,50",
  "R$ 0,25",
  "R$ 0,10",
  "R$ 0,05",
];
const show = (props: Partial<Parameters<typeof CountForm>[0]> = {}) => {
  const s = actionSpy(refusal("DENOMINATIONS_MISMATCH", "A soma das cédulas e moedas não bate."));
  const view = render(<CountForm sessionId="s1" counts={[]} action={s.action} {...props} />);
  return { ...s, ...view };
};

describe("contar o dinheiro da gaveta (spec 014, US4-1 e US4-2)", () => {
  it("a calculadora tem as 12 cédulas e moedas e soma no campo do contado", () => {
    show();
    for (const l of LABELS) expect(screen.getByLabelText(`Quantas de ${l}`)).toBeTruthy();
    typeIn("Quantas de R$ 100", "1");
    typeIn("Quantas de R$ 20", "1");
    typeIn("Quantas de R$ 5", "1");
    expect(valueOf(TOTAL)).toBe("125,00");
    typeIn("Quantas de R$ 0,05", "3");
    expect(valueOf(TOTAL)).toBe("125,15");
    // Quantidade apagada ou que não é número inteiro conta como zero.
    typeIn("Quantas de R$ 0,05", "");
    typeIn("Quantas de R$ 5", "x");
    expect(valueOf(TOTAL)).toBe("120,00");
  });

  it("Confirmar contagem envia o contado e as cédulas usadas", async () => {
    const s = show();
    typeIn("Quantas de R$ 100", "1");
    typeIn("Quantas de R$ 20", "1");
    typeIn("Quantas de R$ 5", "1");
    typeIn("Quantas de R$ 2", "0");
    await clickButton("Confirmar contagem");
    expect(s.calls).toEqual([
      { sessionId: "s1", denominations: '{"100":1,"20":1,"5":1}', counted: "125,00" },
    ]);
  });

  it("o caixa pode digitar o total direto: a calculadora zera e as cédulas não vão", async () => {
    const s = show();
    typeIn("Quantas de R$ 100", "1");
    typeIn(TOTAL, "130,00");
    expect(valueOf("Quantas de R$ 100")).toBe("");
    await clickButton("Confirmar contagem");
    expect(s.calls).toEqual([{ sessionId: "s1", denominations: "", counted: "130,00" }]);
  });

  it("antes de confirmar, nenhum valor esperado está na página, nem no HTML (US4-2)", () => {
    const { container } = show({ counts: ["120.00"] });
    expect(container.innerHTML).not.toMatch(/esperad/i);
    expect(screen.getByText("1ª contagem R$ 120,00")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("contagem que perdeu a validade avisa para contar de novo (US4-6)", () => {
    show({ counts: ["120.00"], outdated: true });
    expect(screen.getByRole("alert").textContent).toBe(
      "Entrou dinheiro no turno depois da contagem. Conte de novo.",
    );
  });

  it("recusa do servidor aparece e o contado continua no campo", async () => {
    show();
    typeIn(TOTAL, "130,00");
    await clickButton("Confirmar contagem");
    expect(screen.getByRole("alert").textContent).toBe("A soma das cédulas e moedas não bate.");
    expect(valueOf(TOTAL)).toBe("130,00");
  });
});

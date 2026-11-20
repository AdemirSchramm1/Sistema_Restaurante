// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { actionSpy } from "@/components/forms/testing";
import { SessionBar } from "./session-bar";
import type { CashBarView } from "./view";

afterEach(cleanup);

const closed: CashBarView = {
  session: null,
  previousKept: null,
  timezone: "America/Sao_Paulo",
  canOperate: true,
  canClose: false,
  serverNow: "2026-11-17T15:00:00.000Z",
};
const open: CashBarView = {
  ...closed,
  canClose: true,
  session: {
    id: "s1",
    openedAt: "2026-11-17T14:02:00.000Z",
    openedByName: "Ana",
    ageHours: 0,
    expected: null,
  },
};
const show = (cash: CashBarView) =>
  render(<SessionBar cash={cash} openAction={actionSpy().action} entryAction={actionSpy().action} />);
const button = (name: string) => screen.queryByRole("button", { name });
const link = (name: string) => screen.queryByRole("link", { name });

describe("barra do caixa (spec 014, US1)", () => {
  it("sem turno: Caixa fechado e Abrir caixa, que abre o formulário do troco (US1-1 e US1-2)", () => {
    show({ ...closed, previousKept: "150.00" });
    expect(screen.getByText("Caixa fechado")).toBeTruthy();
    expect(screen.queryByLabelText("Troco inicial (R$)")).toBeNull();
    fireEvent.click(button("Abrir caixa")!);
    expect((screen.getByLabelText("Troco inicial (R$)") as HTMLInputElement).value).toBe("150,00");
    fireEvent.click(button("Voltar")!);
    expect(screen.queryByLabelText("Troco inicial (R$)")).toBeNull();
  });

  it("garçom vê a situação sem botões, com o caixa fechado e com o caixa aberto", () => {
    show({ ...closed, canOperate: false });
    expect(screen.getByText("Caixa fechado")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toEqual([]);
    cleanup();
    show({ ...open, canOperate: false, canClose: false });
    expect(screen.getByText("Caixa aberto desde 11:02 · Ana")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toEqual([]);
    expect(screen.queryAllByRole("link")).toEqual([]);
  });

  it("com turno: desde quando, por quem, Sangria, Reforço e Fechar caixa (US1-5)", () => {
    show(open);
    expect(screen.getByText("Caixa aberto desde 11:02 · Ana")).toBeTruthy();
    expect(button("Sangria")).toBeTruthy();
    expect(button("Reforço")).toBeTruthy();
    expect(link("Fechar caixa")?.getAttribute("href")).toBe("/caixa/fechar");
    expect(link("Ver o turno")?.getAttribute("href")).toBe("/caixa/turnos/s1");
    expect(button("Abrir caixa")).toBeNull();
    // O caixa conta sem ver: o esperado não aparece para quem não recebeu o valor.
    expect(screen.queryByText(/esperado/i)).toBeNull();
  });

  it("Sangria e Reforço abrem o formulário de cada um; Voltar fecha (US3)", () => {
    show(open);
    fireEvent.click(button("Sangria")!);
    expect(button("Registrar sangria")).toBeTruthy();
    fireEvent.click(button("Reforço")!);
    expect(button("Registrar sangria")).toBeNull();
    expect(button("Registrar reforço")).toBeTruthy();
    fireEvent.click(button("Voltar")!);
    expect(button("Registrar reforço")).toBeNull();
  });

  it("gerente vê o dinheiro esperado na gaveta; negativo em destaque", () => {
    show({ ...open, session: { ...open.session!, expected: "227.00" } });
    expect(screen.getByText("Dinheiro esperado na gaveta: R$ 227,00")).toBeTruthy();
    cleanup();
    show({ ...open, session: { ...open.session!, expected: "-23.00" } });
    expect(screen.getByText("Dinheiro esperado na gaveta: R$ -23,00").className).toContain(
      "text-destructive",
    );
  });

  it("caixa aberto há mais de 24 horas avisa para fechar (caso-limite)", () => {
    show({ ...open, session: { ...open.session!, openedAt: "2026-11-16T14:02:00.000Z", ageHours: 25 } });
    expect(
      screen.getByText("O caixa está aberto desde ontem 11:02. Feche o caixa para conferir o turno."),
    ).toBeTruthy();
    cleanup();
    show({ ...open, session: { ...open.session!, ageHours: 24 } });
    expect(screen.queryByText(/Feche o caixa para conferir/)).toBeNull();
  });

  it("caixa que não abriu o turno lança sangria e reforço, mas não fecha (FR-008)", () => {
    show({ ...open, canClose: false });
    expect(button("Sangria")).toBeTruthy();
    expect(link("Fechar caixa")).toBeNull();
    expect(screen.getByText("Só Ana ou o gerente fecha este caixa.")).toBeTruthy();
    cleanup();
    show({ ...open, canClose: false, session: { ...open.session!, openedByName: null } });
    expect(screen.getByText("Caixa aberto desde 11:02")).toBeTruthy();
    expect(screen.getByText("Só quem abriu ou o gerente fecha este caixa.")).toBeTruthy();
  });
});

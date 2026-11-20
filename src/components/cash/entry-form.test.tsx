// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UUID, actionSpy, clickButton, refusal, typeIn, valueOf } from "@/components/forms/testing";
import { EntryForm } from "./entry-form";

afterEach(cleanup);

const reason = (name: string) => fireEvent.click(screen.getByRole("radio", { name }));
const note = () => screen.getByLabelText(/^Observação/) as HTMLInputElement;

describe("sangria e reforço (spec 014, US3)", () => {
  it("sangria mostra os 4 motivos e só exige a observação em Outro (US3-1)", () => {
    render(<EntryForm kind="WITHDRAWAL" action={actionSpy().action} />);
    for (const r of ["Cofre", "Pagamento a fornecedor", "Despesa do dia", "Outro"])
      expect(screen.getByRole("radio", { name: r })).toBeTruthy();
    reason("Cofre");
    expect(note().required).toBe(false);
    reason("Outro");
    expect(note().required).toBe(true);
    expect(note().maxLength).toBe(140);
  });

  it("envia valor, motivo, observação e o id do lançamento", async () => {
    const s = actionSpy(refusal("VALIDATION", "Confira os dados."));
    render(<EntryForm kind="WITHDRAWAL" action={s.action} />);
    typeIn("Valor (R$)", "150,00");
    reason("Cofre");
    await clickButton("Registrar sangria");
    expect(s.calls).toEqual([
      {
        kind: "WITHDRAWAL",
        clientRequestId: expect.stringMatching(UUID),
        amount: "150,00",
        reason: "SAFE",
        note: "",
      },
    ]);
  });

  it("reforço não tem motivo (US3-3)", async () => {
    const s = actionSpy(refusal("VALIDATION", "Confira os dados."));
    render(<EntryForm kind="SUPPLY" action={s.action} />);
    expect(screen.queryAllByRole("radio")).toEqual([]);
    typeIn("Valor (R$)", "50,00");
    typeIn(/^Observação/, "Troco do cofre");
    await clickButton("Registrar reforço");
    expect(s.calls[0]).toEqual({
      kind: "SUPPLY",
      clientRequestId: expect.stringMatching(UUID),
      amount: "50,00",
      note: "Troco do cofre",
    });
  });

  it("sangria acima do esperado: mostra o erro, guarda o digitado e repetir usa o mesmo id (US3-2 e US3-6)", async () => {
    const s = actionSpy(
      refusal(
        "WITHDRAWAL_EXCEEDS_EXPECTED",
        "A gaveta deve ter R$ 127,00. A sangria não pode passar disso.",
        "amount",
      ),
    );
    render(<EntryForm kind="WITHDRAWAL" action={s.action} />);
    typeIn("Valor (R$)", "200,00");
    reason("Cofre");
    await clickButton("Registrar sangria", 2);
    await clickButton("Registrar sangria");
    expect(screen.getByRole("alert").textContent).toBe(
      "A gaveta deve ter R$ 127,00. A sangria não pode passar disso.",
    );
    expect(valueOf("Valor (R$)")).toBe("200,00");
    expect(s.calls).toHaveLength(3);
    expect(new Set(s.calls.map((c) => c.clientRequestId)).size).toBe(1);
  });

  it("depois de gravar: avisa, oferece Imprimir comprovante, limpa os campos e troca o id (US3-4)", async () => {
    const s = actionSpy({ ok: true, data: { entryId: "e1" }, at: 1 });
    render(<EntryForm kind="WITHDRAWAL" action={s.action} />);
    typeIn("Valor (R$)", "150,00");
    reason("Outro");
    typeIn(/^Observação/, "Gelo");
    await clickButton("Registrar sangria");
    expect(screen.getByRole("status").textContent).toContain("Sangria registrada.");
    expect(screen.getByRole("link", { name: "Imprimir comprovante" }).getAttribute("href")).toBe(
      "/caixa/lancamentos/e1/imprimir",
    );
    expect(valueOf("Valor (R$)")).toBe("");
    expect(note().value).toBe("");
    expect((screen.getByRole("radio", { name: "Outro" }) as HTMLInputElement).checked).toBe(false);
    typeIn("Valor (R$)", "10,00");
    reason("Cofre");
    await clickButton("Registrar sangria");
    expect(s.calls[1]!.clientRequestId).not.toBe(s.calls[0]!.clientRequestId);
  });

  it("reforço gravado avisa com o nome certo", async () => {
    render(
      <EntryForm kind="SUPPLY" action={actionSpy({ ok: true, data: { entryId: "e2" }, at: 1 }).action} />,
    );
    typeIn("Valor (R$)", "50,00");
    await clickButton("Registrar reforço");
    expect(screen.getByRole("status").textContent).toContain("Reforço registrado.");
  });
});

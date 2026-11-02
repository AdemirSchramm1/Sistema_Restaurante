// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SupplierForm } from "./supplier-form";
import { emptySupplierValues } from "./supplier-form-values";

afterEach(cleanup);

const noop = async () => null;

describe("formulário do fornecedor (spec 007, US1)", () => {
  it("tem os blocos de contato, entrega e pagamento, sem campos sanitários ou fiscais", () => {
    render(<SupplierForm action={noop} initial={emptySupplierValues} submitLabel="Salvar" />);
    for (const l of [
      "Nome do fornecedor",
      "Razão social (opcional)",
      "CNPJ (opcional)",
      "Nome do vendedor",
      "Telefone ou WhatsApp",
      "E-mail",
      "Entrega em quantos dias",
      "Pedido mínimo (R$)",
      "Como paga",
      "Observação",
    ])
      expect(screen.getByLabelText(l), l).toBeTruthy();
    expect(screen.getByRole("group", { name: "Dias de entrega" })).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(7);
    for (const gone of [/SIF/i, /licença/i, /inscrição estadual/i, /regime/i])
      expect(screen.queryByLabelText(gone)).toBeNull();
  });

  it("só o nome é obrigatório", () => {
    render(<SupplierForm action={noop} initial={emptySupplierValues} submitLabel="Salvar" />);
    const required = [...document.querySelectorAll("input[required], select[required]")].map(
      (e) => (e as HTMLInputElement).name,
    );
    expect(required).toEqual(["name"]);
  });

  it("marca os dias que já vieram", () => {
    render(
      <SupplierForm
        action={noop}
        initial={{ ...emptySupplierValues, deliveryDays: ["2", "5"] }}
        submitLabel="Salvar"
      />,
    );
    const checked = screen
      .getAllByRole("checkbox")
      .filter((c) => (c as HTMLInputElement).checked)
      .map((c) => (c as HTMLInputElement).value);
    expect(checked).toEqual(["2", "5"]);
  });

  it("quando o servidor recusa o CNPJ, mostra a mensagem no campo e mantém o digitado", async () => {
    const reject = async () => ({
      ok: false as const,
      error: { code: "INVALID_CNPJ" as const, field: "cnpj", message: "CNPJ inválido." },
      at: 1,
    });
    render(<SupplierForm action={reject} initial={emptySupplierValues} submitLabel="Salvar" />);
    fireEvent.change(screen.getByLabelText("Nome do fornecedor"), { target: { value: "Açougue Boi Bom" } });
    fireEvent.change(screen.getByLabelText("CNPJ (opcional)"), { target: { value: "11.222.333/0001-80" } });
    await act(async () => {
      fireEvent.submit(screen.getByRole("form", { name: "Cadastro do fornecedor" }));
    });
    expect((await screen.findAllByText("CNPJ inválido.")).length).toBeGreaterThan(0);
    expect((screen.getByLabelText("Nome do fornecedor") as HTMLInputElement).value).toBe("Açougue Boi Bom");
    expect((screen.getByLabelText("CNPJ (opcional)") as HTMLInputElement).value).toBe("11.222.333/0001-80");
  });
});

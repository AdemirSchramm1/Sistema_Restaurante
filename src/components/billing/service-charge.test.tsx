// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ActionState } from "@/actions/_session";
import { ServiceChargeToggle, ServiceRateForm } from "./service-charge";

afterEach(cleanup);

function spy(result: ActionState = { ok: true, data: null, at: 1 }) {
  const calls: Record<string, string>[] = [];
  const action = async (_prev: ActionState, form: FormData): Promise<ActionState> => {
    calls.push(Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])));
    return result;
  };
  return { calls, action };
}

const click = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
};

const tab = { id: "t12", version: 4, serviceRate: "10", serviceWaived: false, serviceCharge: "7.70" };

describe("tirar a taxa de serviço (spec 011, US1-8)", () => {
  it("pede confirmação com o valor antes de tirar", async () => {
    const s = spy();
    render(<ServiceChargeToggle tab={tab} action={s.action} />);
    await click("Tirar taxa de serviço");
    expect(screen.getByText("Tirar a taxa de serviço de R$ 7,70 desta conta?")).toBeTruthy();
    expect(s.calls).toEqual([]);
    await click("Sim, tirar a taxa");
    expect(s.calls).toEqual([{ tabId: "t12", version: "4", waived: "true" }]);
  });

  it("voltar não tira", async () => {
    const s = spy();
    render(<ServiceChargeToggle tab={tab} action={s.action} />);
    await click("Tirar taxa de serviço");
    await click("Voltar");
    expect(screen.queryByText(/desta conta\?/)).toBeNull();
    expect(s.calls).toEqual([]);
  });

  it("taxa tirada: 'Pôr taxa de volta' desfaz", async () => {
    const s = spy();
    render(
      <ServiceChargeToggle tab={{ ...tab, serviceWaived: true, serviceCharge: "0.00" }} action={s.action} />,
    );
    await click("Pôr taxa de volta");
    expect(s.calls).toEqual([{ tabId: "t12", version: "4", waived: "false" }]);
  });

  it("recusa do servidor aparece em português", async () => {
    const s = spy({
      ok: false,
      error: { code: "PAYMENT_EXCEEDS_REMAINING", message: "Tire um pagamento antes de tirar a taxa." },
      at: 1,
    });
    render(<ServiceChargeToggle tab={tab} action={s.action} />);
    await click("Tirar taxa de serviço");
    await click("Sim, tirar a taxa");
    expect(await screen.findByText("Tire um pagamento antes de tirar a taxa.")).toBeTruthy();
  });

  it("restaurante sem taxa: nada para tirar", () => {
    const { container } = render(
      <ServiceChargeToggle
        tab={{ ...tab, serviceRate: null, serviceCharge: "0.00" }}
        action={spy().action}
      />,
    );
    expect(container.textContent).toBe("");
  });
});

describe("porcentagem da taxa do restaurante (spec 011, FR-004)", () => {
  it("mostra a taxa atual e envia a nova; vazio desliga", async () => {
    const s = spy();
    render(<ServiceRateForm rate="10" version={3} action={s.action} />);
    const input = screen.getByLabelText("Taxa de serviço (%)") as HTMLInputElement;
    expect(input.value).toBe("10");
    expect(
      screen.getByText("Vale para as contas que abrirem depois. Deixe vazio para não cobrar taxa."),
    ).toBeTruthy();
    fireEvent.change(input, { target: { value: "12,5" } });
    await click("Salvar taxa");
    expect(s.calls).toEqual([{ version: "3", rate: "12,5" }]);
  });

  it("taxa desligada aparece vazia", () => {
    render(<ServiceRateForm rate={null} version={3} action={spy().action} />);
    expect((screen.getByLabelText("Taxa de serviço (%)") as HTMLInputElement).value).toBe("");
  });
});

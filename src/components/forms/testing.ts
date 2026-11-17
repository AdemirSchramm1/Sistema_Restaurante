import { act, fireEvent, screen } from "@testing-library/react";
import type { ActionState } from "@/actions/_session";

/** Ajudantes dos testes de formulário: uma Server Action de mentira que guarda o que recebeu. */
export function actionSpy(result: ActionState = { ok: true, data: null, at: 1 }) {
  const calls: Record<string, string>[] = [];
  const action = async (_prev: ActionState, form: FormData): Promise<ActionState> => {
    calls.push(Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])));
    return result;
  };
  return { calls, action };
}

/** Recusa do servidor com o texto que a tela mostra. */
export const refusal = (code: string, message: string, field?: string): ActionState => ({
  ok: false,
  error: { code, message, field },
  at: 1,
});

export async function clickButton(name: string | RegExp, times = 1) {
  await act(async () => {
    for (let i = 0; i < times; i++) fireEvent.click(screen.getByRole("button", { name }));
  });
}

export const typeIn = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

export const valueOf = (label: string | RegExp) => (screen.getByLabelText(label) as HTMLInputElement).value;

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

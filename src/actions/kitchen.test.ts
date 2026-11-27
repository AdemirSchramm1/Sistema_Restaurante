import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * docs/produto/pedidos/03: duas telas mudando o mesmo pedido, a segunda vê "Este pedido mudou em
 * outra tela." e a tela recarrega (spec 018, FR-007: a regra não tinha teste nomeado).
 */

const withContext = vi.fn();
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/infra/server", () => ({ serverDeps: () => ({}) }));
vi.mock("./_session", () => ({ withContext: (fn: unknown) => withContext(fn) }));

const { advanceOrderStatusAction, markDeliveredAction } = await import("./kitchen");

const form = () => {
  const f = new FormData();
  f.set("id", "o1");
  f.set("version", "1");
  f.set("to", "PREPARING");
  return f;
};

describe("cozinha e garçom: pedido mudado em outra tela", () => {
  beforeEach(() => {
    withContext.mockReset();
    revalidatePath.mockReset();
  });

  it("versão velha vira 'Este pedido mudou em outra tela.' e a tela recarrega", async () => {
    withContext.mockResolvedValue({ ok: false, error: { code: "STALE_RECORD", message: "x" } });
    const state = await advanceOrderStatusAction(null, form());
    expect(state).toEqual({
      ok: false,
      error: { code: "STALE_RECORD", message: "Este pedido mudou em outra tela." },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/pedidos/cozinha");
  });

  it("o Entregue do garçom também avisa; outra recusa passa como veio", async () => {
    withContext.mockResolvedValue({ ok: false, error: { code: "STALE_RECORD", message: "x" } });
    expect(await markDeliveredAction(null, form())).toMatchObject({
      error: { message: "Este pedido mudou em outra tela." },
    });
    const forbidden = { ok: false, error: { code: "FORBIDDEN", message: "Sem permissão." } };
    withContext.mockResolvedValue(forbidden);
    expect(await markDeliveredAction(null, form())).toEqual(forbidden);
  });
});

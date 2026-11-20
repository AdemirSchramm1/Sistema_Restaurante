import { describe, it, expect, vi, afterEach } from "vitest";
import { isOffline, send } from "./send-state";

afterEach(() => vi.unstubAllGlobals());

describe("envio do carrinho do garçom (spec 015, R22, FR-021)", () => {
  it("chegou", async () => {
    expect(await send(async () => ({ ok: true, data: { number: 5 }, at: 1 }))).toEqual({
      kind: "sent",
      data: { number: 5 },
    });
  });

  it("o servidor recusou: o carrinho continua livre", async () => {
    expect(
      await send(async () => ({
        ok: false,
        error: { code: "PRICE_CHANGED", message: "Preço mudou.", details: { prices: [] } },
        at: 1,
      })),
    ).toEqual({ kind: "refused", code: "PRICE_CHANGED", message: "Preço mudou.", details: { prices: [] } });
    expect(
      await send(async () => ({ ok: false, error: { code: "FORBIDDEN", message: "Sem acesso." }, at: 1 })),
    ).toMatchObject({ kind: "refused", details: {} });
  });

  it("a resposta não veio (rede caiu, servidor fora): fica sem saber e trava", async () => {
    expect(
      await send(async () => {
        throw new TypeError("Failed to fetch");
      }),
    ).toEqual({ kind: "uncertain" });
    expect(await send(async () => null)).toEqual({ kind: "uncertain" });
  });

  it("sem rede antes de enviar", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(isOffline()).toBe(true);
    vi.stubGlobal("navigator", { onLine: true });
    expect(isOffline()).toBe(false);
  });
});

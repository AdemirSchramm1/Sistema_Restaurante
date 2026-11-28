import { describe, expect, it } from "vitest";
import { adjustmentActions } from "./adjustment-actions";

describe("botões do pedido de acerto pendente (spec 004 e spec 019, US2)", () => {
  it("o gerente decide o pedido dos outros", () => {
    expect(adjustmentActions({ canApprove: true, own: false, smallOperation: false })).toEqual({
      decide: true,
      cancel: false,
      hint: null,
    });
  });

  it("quem pediu só cancela e espera outro gerente", () => {
    expect(adjustmentActions({ canApprove: true, own: true, smallOperation: false })).toEqual({
      decide: false,
      cancel: true,
      hint: "Outro gerente precisa aprovar.",
    });
    expect(adjustmentActions({ canApprove: false, own: true, smallOperation: true })).toEqual({
      decide: false,
      cancel: true,
      hint: "Um gerente precisa aprovar.",
    });
  });

  it("com o modo operação pequena, o gerente decide o próprio pedido (vira exceção)", () => {
    expect(adjustmentActions({ canApprove: true, own: true, smallOperation: true })).toEqual({
      decide: true,
      cancel: true,
      hint: "Operação pequena: se você aprovar, fica marcado como exceção.",
    });
  });

  it("quem não aprova nem pediu só vê", () => {
    expect(adjustmentActions({ canApprove: false, own: false, smallOperation: true })).toEqual({
      decide: false,
      cancel: false,
      hint: null,
    });
  });
});

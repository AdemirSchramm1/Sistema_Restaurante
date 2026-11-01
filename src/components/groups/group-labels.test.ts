import { describe, expect, it } from "vitest";
import { GROUP_FIELD_LABELS, groupSummary } from "./group-labels";

describe("textos da tela de grupos em linguagem do dia a dia (specs/002-simplificar-cadastro FR-005)", () => {
  it("os campos do novo grupo dizem o que pedem, sem sigla solta", () => {
    expect(GROUP_FIELD_LABELS.storageClass).toBe("Que tipo de coisa é");
    expect(GROUP_FIELD_LABELS.inCogs).toBe("Conta no custo dos pratos (CMV)");
    expect(GROUP_FIELD_LABELS.storageClass).not.toMatch(/armazenagem/i);
  });

  it("o resumo do grupo explica o CMV em palavras", () => {
    expect(groupSummary({ storageClass: "FOOD", inCogs: true })).toBe(
      "Alimentar · conta no custo dos pratos",
    );
    expect(groupSummary({ storageClass: "CHEMICAL", inCogs: false })).toBe(
      "Químico (limpeza) · não conta no custo dos pratos",
    );
  });
});

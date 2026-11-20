// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { EntryReceipt } from "./entry-receipt";
import type { EntryView } from "./view";

afterEach(cleanup);

const entry: EntryView = {
  id: "e1",
  kind: "WITHDRAWAL",
  amount: "150.00",
  reason: "SAFE",
  note: "Malote da tarde",
  at: "2026-11-18T01:30:00.000Z",
  byName: "Ana",
  removedAt: null,
  removedByName: null,
};
const show = (e: EntryView) =>
  render(<EntryReceipt entry={e} restaurantName="Cantina da Praça" timezone="America/Sao_Paulo" />);

describe("comprovante de sangria e reforço (spec 014, US3-4)", () => {
  it("sangria: valor, motivo, observação, data e hora do restaurante, quem lançou e assinatura", () => {
    show(entry);
    const receipt = screen.getByRole("article", { name: "Comprovante de sangria" });
    expect(receipt.className).toContain("tab-print");
    expect(screen.getByRole("heading", { name: "Cantina da Praça" })).toBeTruthy();
    expect(screen.getByText("Sangria")).toBeTruthy();
    expect(screen.getByText("R$ 150,00")).toBeTruthy();
    expect(screen.getByText("Cofre")).toBeTruthy();
    expect(screen.getByText("Malote da tarde")).toBeTruthy();
    // 01:30 UTC do dia 18 é 22:30 do dia 17 no restaurante.
    expect(screen.getByText("17/11/2026 22:30")).toBeTruthy();
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("Assinatura")).toBeTruthy();
    expect(screen.getByText("Não é documento fiscal")).toBeTruthy();
  });

  it("reforço: sem motivo e sem observação quando não há", () => {
    show({ ...entry, kind: "SUPPLY", reason: null, note: null, byName: null });
    expect(screen.getByRole("article", { name: "Comprovante de reforço" })).toBeTruthy();
    expect(screen.queryByText("Motivo")).toBeNull();
    expect(screen.queryByText("Observação")).toBeNull();
    expect(screen.queryByText("Lançado por")).toBeNull();
  });

  it("lançamento tirado sai marcado, para o papel não valer como sangria feita", () => {
    show({ ...entry, removedAt: "2026-11-18T01:40:00.000Z", removedByName: "Bruno" });
    expect(screen.getByText("Lançamento tirado às 22:40 por Bruno")).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { TableTabletCard, type TableTabletCardProps } from "./table-tablet-card";

afterEach(cleanup);

const noop = async () => null;
const NOW = "2026-11-16T23:30:00.000Z";
const base: TableTabletCardProps = {
  table: {
    tableId: "t12",
    name: "12",
    version: 2,
    link: "https://app.exemplo/t/abc",
    svg: "<svg data-testid='qr'></svg>",
    boundAt: null,
    lastSeenAt: null,
  },
  now: NOW,
  timezone: "America/Sao_Paulo",
  createAction: noop,
  releaseAction: noop,
  rotateAction: noop,
};
const card = (over: Partial<TableTabletCardProps["table"]> = {}) =>
  render(<TableTabletCard {...base} table={{ ...base.table, ...over }} />);
const region = () => screen.getByRole("region", { name: "Tablet da Mesa 12" });

describe("tablet da mesa na tela Mesas (spec 016, US4)", () => {
  it("sem link: só o botão Criar link do tablet", () => {
    card({ link: null, svg: null });
    expect(within(region()).getByRole("button", { name: "Criar link do tablet" })).toBeTruthy();
    expect(within(region()).queryByRole("button", { name: "Copiar" })).toBeNull();
  });

  it("com link: o link, Copiar, o QR code do link e 'Nenhum tablet ligado'", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    card();
    const r = region();
    expect(within(r).getByText("https://app.exemplo/t/abc")).toBeTruthy();
    expect(within(r).getByRole("img", { name: "QR code do link do tablet da Mesa 12" })).toBeTruthy();
    expect(within(r).getByText("Nenhum tablet ligado")).toBeTruthy();
    fireEvent.click(within(r).getByRole("button", { name: "Copiar" }));
    expect(writeText).toHaveBeenCalledWith("https://app.exemplo/t/abc");
    await waitFor(() => expect(within(r).getByRole("status").textContent).toBe("Link copiado"));
  });

  it("ligado: desde quando e visto há quanto tempo", () => {
    card({ boundAt: "2026-11-16T23:05:00.000Z", lastSeenAt: "2026-11-16T23:28:00.000Z" });
    expect(within(region()).getByText("Tablet ligado desde 16/11 20:05 · visto há 2 min")).toBeTruthy();
  });

  it("acima de 10 min sem sinal: 'Sem sinal há 25 min' em destaque", () => {
    card({ boundAt: "2026-11-16T22:00:00.000Z", lastSeenAt: "2026-11-16T23:05:00.000Z" });
    const lost = within(region()).getByText(/Sem sinal há 25 min/);
    expect(lost.closest("[data-lost]")).not.toBeNull();
  });

  it("Liberar e Trocar link pedem confirmação", () => {
    card({ boundAt: "2026-11-16T23:05:00.000Z" });
    const r = region();
    fireEvent.click(within(r).getByRole("button", { name: "Liberar" }));
    expect(within(r).getByText(/O tablet ligado desliga na hora/)).toBeTruthy();
    expect(within(r).getByRole("button", { name: "Sim, liberar" })).toBeTruthy();
    fireEvent.click(within(r).getByRole("button", { name: "Cancelar" }));
    fireEvent.click(within(r).getByRole("button", { name: "Trocar link" }));
    expect(within(r).getByText(/O link antigo para de funcionar/)).toBeTruthy();
    expect(within(r).getByRole("button", { name: "Sim, trocar link" })).toBeTruthy();
  });

  it("sem tablet ligado não oferece Liberar", () => {
    card();
    expect(within(region()).queryByRole("button", { name: "Liberar" })).toBeNull();
  });

  it("ajuda: como travar o tablet", () => {
    card();
    const help = within(region()).getByText("Como travar o tablet").closest("details")!;
    for (const text of [/Fixar app/, /Acesso Guiado/, /não pela Tela de Início/, /Bloqueio automático: Nunca/])
      expect(within(help).getByText(text)).toBeTruthy();
  });
});

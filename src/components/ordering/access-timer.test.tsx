// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { AccessTimer } from "./access-timer";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const serverNow = "2026-11-08T20:00:00.000Z";
const expiresAt = "2026-11-08T20:05:00.000Z";

describe("tempo do acesso (spec 009, US3)", () => {
  it("conta pelo relógio do servidor, não pelo do celular", () => {
    vi.setSystemTime(new Date("2026-11-08T21:00:00.000Z")); // celular uma hora adiantado
    render(<AccessTimer serverNow={serverNow} expiresAt={expiresAt} unsent={[]} />);
    expect(screen.getByText("Faltam 5 min")).toBeTruthy();
  });

  it("avisa nos 2 últimos minutos só se tiver coisa sem enviar", () => {
    vi.setSystemTime(new Date(serverNow));
    const { rerender } = render(<AccessTimer serverNow={serverNow} expiresAt={expiresAt} unsent={[]} />);
    act(() => vi.advanceTimersByTime(3 * 60_000));
    expect(screen.queryByText(/Envie o pedido/)).toBeNull();
    rerender(<AccessTimer serverNow={serverNow} expiresAt={expiresAt} unsent={[{ name: "Suco", quantity: 1 }]} />);
    expect(screen.getByText("Faltam 2 minutos. Envie o pedido para não perder o que escolheu.")).toBeTruthy();
  });

  it("no fim mostra 'Seu tempo acabou' com o que não foi enviado", () => {
    vi.setSystemTime(new Date(serverNow));
    const onExpire = vi.fn();
    render(
      <AccessTimer
        serverNow={serverNow}
        expiresAt={expiresAt}
        unsent={[{ name: "Suco", quantity: 2 }]}
        onExpire={onExpire}
      />,
    );
    act(() => vi.advanceTimersByTime(5 * 60_000));
    expect(screen.getByText("Seu tempo acabou. Escaneie o QR code da mesa de novo para continuar.")).toBeTruthy();
    expect(screen.getByText("2 × Suco")).toBeTruthy();
    expect(onExpire).toHaveBeenCalled();
  });
});

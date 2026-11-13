// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { AutoRefresh } from "./auto-refresh";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

let visibility: DocumentVisibilityState = "visible";
const setVisibility = (v: DocumentVisibilityState) => {
  visibility = v;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  refresh.mockClear();
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("atualização automática (research R4)", () => {
  it("atualiza a cada intervalo com a aba à vista", () => {
    render(<AutoRefresh seconds={10} />);
    vi.advanceTimersByTime(9_999);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(20_001);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("para com a aba escondida e atualiza na hora ao voltar", () => {
    render(<AutoRefresh seconds={10} />);
    setVisibility("hidden");
    vi.advanceTimersByTime(60_000);
    expect(refresh).not.toHaveBeenCalled();
    setVisibility("visible");
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("aberta em segundo plano, só começa quando a aba aparece", () => {
    visibility = "hidden";
    render(<AutoRefresh seconds={5} />);
    vi.advanceTimersByTime(30_000);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("sair da tela desliga o relógio", () => {
    const { unmount } = render(<AutoRefresh seconds={5} />);
    unmount();
    vi.advanceTimersByTime(30_000);
    setVisibility("visible");
    expect(refresh).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { MenuView } from "@/application/ordering/menu";
import { renderToString } from "react-dom/server";
import { TabletShell } from "./tablet-shell";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

/** Tablet fixo na mesa (spec 016, US5; R4, R5). */
const menu: MenuView = {
  mode: "TABLET",
  appearance: { logo: null, cover: null },
  restaurantName: "Cantina da Nona",
  tableName: "12",
  serverNow: "2026-11-16T23:00:00.000Z",
  expiresAt: null,
  ordersLeft: null,
  showSectionTitles: false,
  sections: [
    {
      id: null,
      name: "Outros",
      products: [
        { id: "s", name: "Suco", price: "9.00", description: null, photo: null, addons: [], removables: [] },
      ],
    },
  ],
};

type Status = { state: string; tableName?: string; tabId?: string | null; stamp?: string };
let replies: (Status | "FAIL" | "ERROR")[] = [];
let last: Status = { state: "OK", tableName: "12", tabId: null, stamp: "a" };
const fetchMock = vi.fn(async (_url: string) => {
  const next = replies.shift();
  if (next === "FAIL") throw new TypeError("rede");
  if (next === "ERROR") return new Response("erro", { status: 500 });
  if (next) last = next;
  return new Response(JSON.stringify(last), { status: last.state === "UNKNOWN" ? 401 : 200 });
});

const submit = vi.fn(async () => ({
  ok: true as const,
  data: { orderId: "o1", number: 7, total: "9.00", status: "RECEIVED" as const },
  at: 1,
}));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval", "Date"] });
  vi.setSystemTime(new Date("2026-11-16T23:00:00.000Z"));
  vi.stubGlobal("fetch", fetchMock);
  replies = [];
  last = { state: "OK", tableName: "12", tabId: null, stamp: "a" };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetchMock.mockClear();
  refresh.mockClear();
  submit.mockClear();
  localStorage.clear();
});

const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const start = () => fireEvent.click(screen.getByRole("button", { name: "Ver o cardápio" }));
const addJuice = () => fireEvent.click(screen.getByRole("button", { name: "Pôr Suco no carrinho" }));
const welcome = () => screen.queryByRole("region", { name: "Boas-vindas" });
const total = () => screen.queryByTestId("cart-total")?.textContent ?? null;

describe("tablet da mesa (spec 016, US5)", () => {
  it("abre nas boas-vindas; Ver o cardápio mostra o cardápio sem tempo de acesso", async () => {
    render(<TabletShell menu={menu} orders={[]} submit={submit} />);
    expect(welcome()).not.toBeNull();
    start();
    expect(welcome()).toBeNull();
    expect(screen.queryByText(/Faltam/)).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Mesa 12" })).toBeTruthy();
  });

  it("parado 3 min com carrinho: Ainda está aí?; 30 s depois limpa e volta às boas-vindas", async () => {
    render(<TabletShell menu={menu} orders={[]} submit={submit} />);
    start();
    addJuice();
    expect(total()).toBe("R$ 9,00");
    await advance(179_000);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await advance(2_000);
    expect(screen.getByRole("alertdialog", { name: "Ainda está aí?" })).toBeTruthy();
    await advance(31_000);
    expect(welcome()).not.toBeNull();
    start();
    expect(total()).toBe("R$ 0,00");
  });

  it("Continuar mantém o carrinho; toques e teclas contam como uso", async () => {
    render(<TabletShell menu={menu} orders={[]} submit={submit} />);
    start();
    addJuice();
    await advance(170_000);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    await advance(20_000);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await advance(170_000);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(total()).toBe("R$ 9,00");
  });

  it("parado 3 min com carrinho vazio volta direto às boas-vindas", async () => {
    render(<TabletShell menu={menu} orders={[]} submit={submit} />);
    start();
    await advance(181_000);
    expect(welcome()).not.toBeNull();
  });

  it("depois de enviar: 'Pedido enviado para a cozinha' por 10 s e o cardápio limpo", async () => {
    render(<TabletShell menu={menu} orders={[]} submit={submit} />);
    start();
    addJuice();
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await advance(0);
    expect(submit).toHaveBeenCalled();
    // O aviso fica por cima, visível mesmo com o carrinho fechado (tablet em pé).
    expect(screen.getByTestId("tablet-sent").textContent).toBe("Pedido enviado para a cozinha");
    await advance(10_500);
    expect(screen.queryByTestId("tablet-sent")).toBeNull();
    expect(screen.queryByText("Pedido enviado para a cozinha")).toBeNull();
    expect(welcome()).toBeNull();
    expect(total()).toBe("R$ 0,00");
  });

  it("checa o restaurante a cada 60 s nas boas-vindas e a cada 10 s no cardápio", async () => {
    render(<TabletShell menu={menu} orders={[]} submit={submit} />);
    await advance(0);
    const first = fetchMock.mock.calls.length;
    await advance(30_000);
    expect(fetchMock.mock.calls.length).toBe(first);
    await advance(30_000);
    expect(fetchMock.mock.calls.length).toBe(first + 1);
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/cardapio/tablet");
    start();
    const inMenu = fetchMock.mock.calls.length;
    await advance(30_000);
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(inMenu + 3);
  });

  it("stamp novo atualiza a página; conta nova volta às boas-vindas sem o carrinho", async () => {
    render(<TabletShell menu={menu} orders={[]} submit={submit} />);
    replies = [{ state: "OK", tableName: "12", tabId: "tab1", stamp: "a" }];
    await advance(0);
    start();
    addJuice();
    replies = [{ state: "OK", tableName: "12", tabId: "tab1", stamp: "b" }];
    await advance(10_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(welcome()).toBeNull();
    replies = [{ state: "OK", tableName: "12", tabId: null, stamp: "c" }];
    await advance(10_000);
    expect(welcome()).not.toBeNull();
    start();
    expect(total()).toBe("R$ 0,00");
  });

  it("nas boas-vindas a página inteira se atualiza a cada 5 min (esgotados e preços)", async () => {
    render(<TabletShell menu={menu} orders={[]} submit={submit} />);
    await advance(0);
    await advance(4 * 60_000);
    expect(refresh).not.toHaveBeenCalled();
    await advance(60_000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("a primeira conta da mesa abrir (pedido deste tablet) não limpa nada", async () => {
    render(<TabletShell menu={menu} orders={[]} submit={submit} />);
    await advance(0);
    start();
    addJuice();
    replies = [{ state: "OK", tableName: "12", tabId: "tab1", stamp: "b" }];
    await advance(10_000);
    expect(welcome()).toBeNull();
    expect(total()).toBe("R$ 9,00");
  });

  it("mesa inativa mostra a mensagem e volta sozinha; liberado e link trocado também avisam", async () => {
    render(<TabletShell menu={menu} orders={[]} submit={submit} />);
    await advance(0);
    start();
    replies = [{ state: "TABLE_INACTIVE", tableName: "12", tabId: null, stamp: "a" }];
    await advance(10_000);
    expect(screen.getByRole("alert").textContent).toContain(
      "Esta mesa não está recebendo pedidos. Chame um garçom.",
    );
    replies = [{ state: "OK", tableName: "12", tabId: null, stamp: "a" }];
    await advance(10_000);
    expect(screen.queryByRole("alert")).toBeNull();
    replies = [{ state: "RELEASED", tableName: "12", tabId: null, stamp: "a" }];
    await advance(10_000);
    expect(screen.getByRole("alert").textContent).toContain("Este tablet foi desligado. Peça ao gerente.");
    replies = [{ state: "LINK_ROTATED", tableName: "12", tabId: null, stamp: "a" }];
    await advance(10_000);
    expect(screen.getByRole("alert").textContent).toContain("Link inválido. Chame um garçom.");
  });

  it("sem conexão: duas falhas seguidas mostram o aviso sem limpar o carrinho; o primeiro sucesso tira", async () => {
    render(<TabletShell menu={menu} orders={[]} submit={submit} />);
    await advance(0);
    start();
    await advance(0);
    addJuice();
    replies = ["FAIL"];
    await advance(10_000);
    expect(screen.queryByRole("alert")).toBeNull();
    replies = ["FAIL"];
    await advance(10_000);
    expect(screen.getByRole("alert").textContent).toContain(
      "Sem conexão com o restaurante. Chame um garçom.",
    );
    expect(total()).toBe("R$ 9,00");
    await advance(10_000);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(total()).toBe("R$ 9,00");
  });

  it("o evento offline mostra o aviso na hora", async () => {
    render(<TabletShell menu={menu} orders={[]} submit={submit} />);
    start();
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByRole("alert").textContent).toContain("Sem conexão com o restaurante");
  });

  it("tela sempre acesa ao entrar no cardápio e ao voltar à aba; sem a API não quebra", async () => {
    const request = vi.fn().mockResolvedValue({ release: vi.fn(), addEventListener: vi.fn() });
    Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });
    render(<TabletShell menu={menu} orders={[]} submit={submit} />);
    expect(request).not.toHaveBeenCalled();
    start();
    await advance(0);
    expect(request).toHaveBeenCalledWith("screen");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await advance(0);
    expect(request).toHaveBeenCalledTimes(2);
    cleanup();
    // @ts-expect-error -- apaga a API para o teste
    delete navigator.wakeLock;
    render(<TabletShell menu={menu} orders={[]} submit={submit} />);
    start();
    await advance(0);
    expect(screen.getByRole("heading", { level: 1, name: "Mesa 12" })).toBeTruthy();
  });

  it("Tela cheia só aparece quando o navegador permite", async () => {
    render(<TabletShell menu={menu} orders={[]} submit={submit} />);
    start();
    expect(screen.queryByRole("button", { name: "Tela cheia" })).toBeNull();
    cleanup();
    Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true });
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    document.documentElement.requestFullscreen = requestFullscreen;
    render(<TabletShell menu={menu} orders={[]} submit={submit} />);
    start();
    await advance(0);
    fireEvent.click(screen.getByRole("button", { name: "Tela cheia" }));
    expect(requestFullscreen).toHaveBeenCalled();
    Object.defineProperty(document, "fullscreenEnabled", { value: false, configurable: true });
  });

  it("o navegador diz que está sem rede: uma resposta que chega atrasada não tira o aviso", async () => {
    render(<TabletShell menu={menu} orders={[]} submit={submit} />);
    start();
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    await advance(0);
    expect(fetchMock).toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Sem conexão com o restaurante");
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    await advance(10_000);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("erro do servidor conta como falha; voltar a rede checa na hora", async () => {
    render(<TabletShell menu={menu} orders={[]} submit={submit} />);
    await advance(0);
    start();
    await advance(0);
    replies = ["ERROR"];
    await advance(10_000);
    replies = ["ERROR"];
    await advance(10_000);
    expect(screen.getByRole("alert").textContent).toContain("Sem conexão com o restaurante");
    const calls = fetchMock.mock.calls.length;
    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock.mock.calls.length).toBe(calls + 1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("aparelho desconhecido (401 sem stamp nem conta): avisa que o link não vale", async () => {
    replies = [{ state: "UNKNOWN" }];
    render(<TabletShell menu={menu} orders={[]} submit={submit} />);
    await advance(0);
    expect(screen.getByRole("alert").textContent).toContain("Link inválido. Chame um garçom.");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("tela acesa: pedido que chega depois de sair é solto; aba escondida não pede; soltar que falha não quebra", async () => {
    let resolve!: (lock: { release(): Promise<void> }) => void;
    const late = vi.fn().mockRejectedValue(new Error("já solto"));
    const request = vi.fn(() => new Promise<{ release(): Promise<void> }>((r) => (resolve = r)));
    Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });
    render(<TabletShell menu={menu} orders={[]} submit={submit} />);
    start();
    await advance(0);
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(request).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    cleanup();
    await act(async () => {
      resolve({ release: late });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(late).toHaveBeenCalledTimes(1);
    // @ts-expect-error -- apaga a API para os outros testes
    delete navigator.wakeLock;
  });

  it("Tela cheia recusada pelo navegador: segue sem tela cheia", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true });
    const requestFullscreen = vi.fn().mockRejectedValue(new Error("negado"));
    document.documentElement.requestFullscreen = requestFullscreen;
    render(<TabletShell menu={menu} orders={[]} submit={submit} />);
    start();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Tela cheia" }));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(requestFullscreen).toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1, name: "Mesa 12" })).toBeTruthy();
    Object.defineProperty(document, "fullscreenEnabled", { value: false, configurable: true });
  });

  it("no servidor a página sai sem o botão Tela cheia (o navegador decide depois)", () => {
    Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true });
    const html = renderToString(<TabletShell menu={menu} orders={[]} submit={submit} />);
    expect(html).toContain("Ver o cardápio");
    expect(html).not.toContain("Tela cheia");
    Object.defineProperty(document, "fullscreenEnabled", { value: false, configurable: true });
  });

  it("o carrinho não vai para o localStorage", async () => {
    render(<TabletShell menu={menu} orders={[]} submit={submit} />);
    start();
    addJuice();
    expect(localStorage.length).toBe(0);
  });

  it("'Pedidos enviados' no lugar de 'Meus pedidos'", () => {
    render(
      <TabletShell
        menu={menu}
        orders={[
          {
            number: 3,
            submittedAt: "2026-11-16T22:00:00.000Z",
            status: "PREPARING",
            total: "9.00",
            lines: [],
          },
        ]}
        submit={submit}
      />,
    );
    start();
    expect(screen.getByRole("region", { name: "Pedidos enviados" })).toBeTruthy();
  });
});

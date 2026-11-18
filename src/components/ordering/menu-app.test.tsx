// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MenuApp } from "./menu-app";
import type { MenuView } from "@/application/ordering/menu";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => {
  cleanup();
  refresh.mockClear();
});

const menu: MenuView = {
  mode: "QR",
  appearance: { logo: null, cover: null },
  restaurantName: "Cantina da Nona",
  tableName: "5",
  serverNow: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
  ordersLeft: 10,
  showSectionTitles: false,
  sections: [
    {
      id: null,
      name: "Outros",
      products: [
        { id: "s", name: "Suco", price: "9.00", description: null, photo: null, addons: [], removables: [] },
        {
          id: "b",
          name: "X-Burger",
          price: "28.00",
          description: null,
          photo: null,
          addons: [{ id: "q", name: "Fatia de queijo", price: "3.00", maxTimes: 2 }],
          removables: [{ kind: "ITEM", id: "c", label: "Sem cebola" }],
        },
      ],
    },
  ],
};

describe("cardápio do celular (spec 009 US2, spec 010 US3)", () => {
  it("mostra o restaurante, a mesa e os produtos", () => {
    render(<MenuApp menu={menu} orders={[]} submit={vi.fn()} />);
    expect(screen.getByText("Cantina da Nona")).toBeTruthy();
    expect(screen.getByText("Mesa 5")).toBeTruthy();
    expect(screen.getAllByText("R$ 28,00")[0]).toBeTruthy();
  });

  it("cada prato é um cartão, com o preço em destaque (spec 012)", () => {
    render(<MenuApp menu={menu} orders={[]} submit={vi.fn()} />);
    const items = within(screen.getByRole("list", { name: "Cardápio" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    for (const item of items) expect(item.className).toContain("bg-card");
    const price = within(items[1]!).getAllByText("R$ 28,00")[0]!;
    expect(price.className).toContain("text-primary");
    expect(price.className).toContain("font-semibold");
  });

  it("produto sem opções vai direto para o pedido", () => {
    render(<MenuApp menu={menu} orders={[]} submit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pôr Suco no carrinho" }));
    expect(screen.getByTestId("cart-total").textContent).toBe("R$ 9,00");
  });

  it("produto com opções abre a tela do prato", () => {
    render(<MenuApp menu={menu} orders={[]} submit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pôr X-Burger no carrinho" }));
    const dish = screen.getByRole("region", { name: "X-Burger" });
    fireEvent.click(within(dish).getByRole("button", { name: "Sem cebola" }));
    fireEvent.click(within(dish).getByRole("button", { name: "Adicionar ao pedido" }));
    expect(screen.getByTestId("cart-total").textContent).toBe("R$ 28,00");
    expect(screen.getAllByRole("listitem").some((li) => li.textContent === "SEM cebola")).toBe(true);
  });

  it("busca pelo nome sem acento", () => {
    render(<MenuApp menu={menu} orders={[]} submit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Buscar no cardápio"), { target: { value: "burg" } });
    expect(screen.queryByRole("button", { name: "Pôr Suco no carrinho" })).toBeNull();
    expect(screen.getByRole("button", { name: "Pôr X-Burger no carrinho" })).toBeTruthy();
  });

  it("sem pedidos restantes no acesso, pede para chamar o garçom", () => {
    render(<MenuApp menu={{ ...menu, ordersLeft: 0 }} orders={[]} submit={vi.fn()} />);
    expect(screen.getByText("Chame um garçom para continuar pedindo.")).toBeTruthy();
  });
});

/** Spec 013, US6: seções, fotos e descrições no cardápio do cliente. */
const photoOf = (name: string) => ({ base: `/fotos/menu/${name}`, widths: [300, 600] });
const product = (id: string, name: string, over: Partial<MenuView["sections"][0]["products"][0]> = {}) => ({
  id,
  name,
  price: "10.00",
  description: null,
  photo: null,
  addons: [],
  removables: [],
  ...over,
});
const sectioned: MenuView = {
  ...menu,
  showSectionTitles: true,
  sections: [
    {
      id: "s1",
      name: "Lanches",
      products: [
        product("b", "X-Burger", {
          photo: photoOf("b"),
          description: "Pão, carne e queijo.\nFeito na hora.",
        }),
        product("x", "X-Salada"),
        product("d", "X-Bacon", { photo: photoOf("d") }),
      ],
    },
    {
      id: "s2",
      name: "Bebidas",
      products: [product("s", "Suco", { photo: photoOf("s") }), product("a", "Água")],
    },
    { id: null, name: "Outros", products: [product("p", "Pudim", { photo: photoOf("p") })] },
  ],
};
const buttons = () =>
  screen.getAllByRole("button", { name: /^Pôr .* no carrinho$/ }).map((b) => b.getAttribute("aria-label"));

describe("cardápio do cliente por seção (spec 013, US6)", () => {
  it("cada seção tem um título h2 com âncora e a sua lista de cartões", () => {
    render(<MenuApp menu={sectioned} orders={[]} submit={vi.fn()} />);
    const titles = screen.getAllByRole("heading", { level: 2 }).filter((h) => h.id.startsWith("secao-"));
    expect(titles.map((h) => [h.textContent, h.id])).toEqual([
      ["Lanches", "secao-s1"],
      ["Bebidas", "secao-s2"],
      ["Outros", "secao-outros"],
    ]);
    const lanches = screen.getByRole("list", { name: "Lanches" });
    expect(
      within(lanches)
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(["X-Burger", "X-Salada", "X-Bacon"]);
    expect(lanches.className).toContain("tab:grid-cols-3");
    expect(lanches.className).toContain("xl:grid-cols-4");
    const links = within(screen.getByRole("navigation", { name: "Seções do cardápio" })).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["#secao-s1", "#secao-s2", "#secao-outros"]);
  });

  it("sem nenhuma seção: uma lista só, sem títulos e sem a barra", () => {
    render(<MenuApp menu={menu} orders={[]} submit={vi.fn()} />);
    expect(screen.queryByRole("navigation", { name: "Seções do cardápio" })).toBeNull();
    expect(screen.queryByRole("heading", { level: 2, name: "Outros" })).toBeNull();
    expect(screen.getByRole("list", { name: "Cardápio" })).toBeTruthy();
  });

  it("só as duas primeiras fotos da tela vêm sem espera", () => {
    render(<MenuApp menu={sectioned} orders={[]} submit={vi.fn()} />);
    // A foto do cartão é decorativa (o nome vem ao lado): acha pelo título do cartão.
    const photos = [...document.querySelectorAll("li img[data-photo]")];
    expect(
      photos.map((i) => [i.closest("li")!.querySelector("h3")!.textContent, i.getAttribute("loading")]),
    ).toEqual([
      ["X-Burger", "eager"],
      ["X-Bacon", "eager"],
      ["Suco", "lazy"],
      ["Pudim", "lazy"],
    ]);
  });

  it("a busca procura em todas as seções e mantém a ordem do cardápio, sem títulos", () => {
    render(<MenuApp menu={sectioned} orders={[]} submit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Buscar no cardápio"), { target: { value: "u" } });
    expect(buttons()).toEqual([
      "Pôr X-Burger no carrinho",
      "Pôr Suco no carrinho",
      "Pôr Água no carrinho",
      "Pôr Pudim no carrinho",
    ]);
    expect(screen.queryByRole("navigation", { name: "Seções do cardápio" })).toBeNull();
    expect(screen.queryByRole("heading", { level: 2, name: "Lanches" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Buscar no cardápio"), { target: { value: "zzz" } });
    expect(screen.getByText("Nada com esse nome.")).toBeTruthy();
  });

  it("tocar no nome abre a tela do prato com a descrição inteira, mesmo sem opções", () => {
    render(<MenuApp menu={sectioned} orders={[]} submit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /^Ver X-Burger/ }));
    const dish = screen.getByRole("region", { name: "X-Burger" });
    expect(within(dish).getByText(/Pão, carne e queijo/).textContent).toBe(
      "Pão, carne e queijo.\nFeito na hora.",
    );
    fireEvent.click(within(dish).getByRole("button", { name: "Adicionar ao pedido" }));
    expect(screen.getByTestId("cart-total").textContent).toBe("R$ 10,00");
  });

  it("a atualização automática troca foto e ordem sem perder o carrinho", () => {
    const view = render(<MenuApp menu={sectioned} orders={[]} submit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pôr Suco no carrinho" }));
    const refreshed: MenuView = {
      ...sectioned,
      serverNow: new Date(Date.now() + 10_000).toISOString(),
      sections: [
        {
          id: "s2",
          name: "Bebidas",
          products: [product("a", "Água", { photo: photoOf("nova") }), product("s", "Suco")],
        },
        sectioned.sections[0]!,
      ],
    };
    view.rerender(<MenuApp menu={refreshed} orders={[]} submit={vi.fn()} />);
    expect(buttons().slice(0, 2)).toEqual(["Pôr Água no carrinho", "Pôr Suco no carrinho"]);
    const photoOfCard = (name: string) =>
      screen.getByRole("heading", { level: 3, name }).closest("li")!.querySelector("img");
    expect(photoOfCard("Água")!.getAttribute("src")).toBe("/fotos/menu/nova/300.webp");
    expect(photoOfCard("Suco")).toBeNull();
    expect(screen.getByTestId("cart-total").textContent).toBe("R$ 10,00");
  });

  it("marca na barra a seção que está na tela", () => {
    type Entry = { target: Element; isIntersecting: boolean };
    let notify: (entries: Entry[]) => void = () => undefined;
    const observed: Element[] = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: (entries: Entry[]) => void) {
          notify = cb;
        }
        observe(el: Element) {
          observed.push(el);
        }
        disconnect() {}
      },
    );
    render(<MenuApp menu={sectioned} orders={[]} submit={vi.fn()} />);
    expect(observed.map((el) => el.id)).toEqual(["secao-s1", "secao-s2", "secao-outros"]);
    const current = () =>
      screen
        .getAllByRole("link")
        .filter((a) => a.getAttribute("aria-current") === "true")
        .map((a) => a.textContent);
    expect(current()).toEqual([]);
    act(() => notify([{ target: observed[1]!, isIntersecting: true }]));
    expect(current()).toEqual(["Bebidas"]);
    act(() => notify([{ target: observed[1]!, isIntersecting: false }]));
    expect(current()).toEqual(["Bebidas"]);
    act(() => notify([{ target: observed[2]!, isIntersecting: true }]));
    expect(current()).toEqual(["Outros"]);
    // Tocou em Lanches na barra: o pulo passa por outras seções sem trocar a marca, até a pessoa usar o teclado.
    fireEvent.click(screen.getByRole("link", { name: "Lanches" }));
    act(() => notify([{ target: observed[1]!, isIntersecting: true }]));
    expect(current()).toEqual(["Lanches"]);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    act(() => notify([{ target: observed[1]!, isIntersecting: true }]));
    expect(current()).toEqual(["Bebidas"]);
    vi.unstubAllGlobals();
  });
});

describe("girar o aparelho (spec 013, US6.8)", () => {
  const box = (top: number, bottom: number) => () => ({ top, bottom }) as DOMRect;
  const setup = () => {
    Object.defineProperty(document.documentElement, "scrollHeight", { value: 5000, configurable: true });
    render(<MenuApp menu={sectioned} orders={[]} submit={vi.fn()} />);
    const scrolled = vi.fn();
    const places = [...document.querySelectorAll<HTMLElement>("[data-place]")];
    for (const el of places) {
      el.getBoundingClientRect = box(-300, -200);
      el.scrollIntoView = () => scrolled(el.id || el.textContent);
    }
    return { scrolled, places };
  };
  const set = (name: "scrollY" | "innerWidth" | "innerHeight", value: number) =>
    Object.defineProperty(window, name, { value, configurable: true });
  afterEach(() => {
    set("scrollY", 0);
    set("innerWidth", 1024);
    set("innerHeight", 768);
  });

  it("o título de seção e os cartões são os pontos que a tela mantém", () => {
    const { places } = setup();
    expect(places.map((el) => el.tagName)).toEqual(["H2", "LI", "LI", "LI", "H2", "LI", "LI", "H2", "LI"]);
  });

  it("volta ao que estava no topo quando a largura muda", () => {
    const { scrolled, places } = setup();
    places[4]!.getBoundingClientRect = box(70, 100);
    places[5]!.getBoundingClientRect = box(120, 400);
    set("scrollY", 500);
    fireEvent.scroll(window);
    set("innerWidth", 568);
    fireEvent(window, new Event("resize"));
    expect(scrolled.mock.calls).toEqual([["secao-s2"]]);
  });

  it("no fim da página, volta ao fim depois de girar (cardápio curto, spec 016)", () => {
    const { scrolled } = setup();
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    set("scrollY", 5000 - 768);
    fireEvent.scroll(window);
    set("innerWidth", 568);
    fireEvent(window, new Event("resize"));
    expect(scrolled).not.toHaveBeenCalled();
    expect(scrollTo).toHaveBeenCalledWith(0, 5000);
    vi.unstubAllGlobals();
  });

  it("no fim da página, o que estava no topo continua sendo o ponto que a tela mantém ao girar", () => {
    const { scrolled, places } = setup();
    vi.stubGlobal("scrollTo", vi.fn());
    places[4]!.getBoundingClientRect = box(70, 100);
    set("scrollY", 5000 - 768);
    fireEvent.scroll(window);
    // Deitado, o fim da página deixaria o título de Bebidas acima da tela.
    places[4]!.getBoundingClientRect = box(-485, -455);
    set("innerWidth", 844);
    fireEvent(window, new Event("resize"));
    expect(scrolled.mock.calls).toEqual([["secao-s2"]]);
    vi.unstubAllGlobals();
  });

  it("no fim da página a última seção fica marcada na barra", () => {
    setup();
    set("scrollY", 5000 - 768);
    act(() => fireEvent.scroll(window));
    const marked = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("aria-current") === "true")
      .map((a) => a.textContent);
    expect(marked).toEqual(["Outros"]);
  });

  it("tocar numa seção da barra a marca, mesmo quando a página não rola até ela; rolar de novo volta a valer", () => {
    setup();
    const marked = () =>
      screen
        .getAllByRole("link")
        .filter((a) => a.getAttribute("aria-current") === "true")
        .map((a) => a.textContent);
    fireEvent.click(screen.getByRole("link", { name: "Bebidas" }));
    expect(marked()).toEqual(["Bebidas"]);
    // O pulo até a âncora para no fim da página: continua a seção tocada.
    set("scrollY", 5000 - 768);
    act(() => fireEvent.scroll(window));
    expect(marked()).toEqual(["Bebidas"]);
    // A pessoa rola: o fim da página volta a marcar a última seção.
    act(() => {
      fireEvent.touchStart(window);
      fireEvent.scroll(window);
    });
    expect(marked()).toEqual(["Outros"]);
  });

  it("não mexe quando só a altura muda (a barra do navegador some ao rolar)", () => {
    const { scrolled, places } = setup();
    places[4]!.getBoundingClientRect = box(70, 100);
    set("scrollY", 500);
    fireEvent.scroll(window);
    set("innerHeight", 500);
    fireEvent(window, new Event("resize"));
    expect(scrolled).not.toHaveBeenCalled();
  });

  it("não mexe quando a página está no topo", () => {
    const { scrolled, places } = setup();
    places[0]!.getBoundingClientRect = box(200, 230);
    fireEvent.scroll(window);
    set("innerWidth", 568);
    fireEvent(window, new Event("resize"));
    expect(scrolled).not.toHaveBeenCalled();
  });
});

describe("pré-visualização para a equipe (spec 013, US5)", () => {
  const preview = { showSectionTitles: sectioned.showSectionTitles, sections: sectioned.sections };

  it("mostra a faixa de pré-visualização e o mesmo cardápio do cliente", () => {
    render(<MenuApp preview menu={preview} />);
    expect(screen.getAllByRole("status")[0]!.textContent).toBe("Pré-visualização: pedidos não são enviados");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Cardápio");
    expect(buttons()).toHaveLength(6);
    expect(screen.getByRole("navigation", { name: "Seções do cardápio" })).toBeTruthy();
  });

  it("não tem botão de enviar, contador de tempo, Meus pedidos nem atualização automática", () => {
    vi.useFakeTimers();
    render(<MenuApp preview menu={preview} />);
    fireEvent.click(screen.getByRole("button", { name: "Pôr Suco no carrinho" }));
    // O carrinho aparece, para ver como fica, mas não envia.
    expect(screen.getByTestId("cart-total").textContent).toBe("R$ 10,00");
    expect(screen.queryByRole("button", { name: "Enviar pedido" })).toBeNull();
    expect(screen.queryByText(/Faltam \d+ min/)).toBeNull();
    expect(screen.queryByRole("region", { name: "Meus pedidos" })).toBeNull();
    vi.advanceTimersByTime(60_000);
    expect(refresh).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("o cardápio de verdade continua atualizando sozinho e mostrando o tempo", () => {
    vi.useFakeTimers();
    render(<MenuApp menu={sectioned} orders={[]} submit={vi.fn()} />);
    expect(screen.queryByText("Pré-visualização: pedidos não são enviados")).toBeNull();
    expect(screen.getByText(/Faltam \d+ min/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enviar pedido" })).toBeTruthy();
    vi.advanceTimersByTime(10_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe("busca digitada antes da página ficar pronta (spec 013, US6)", () => {
  it("o que já está no campo quando a página fica pronta vale como busca", async () => {
    const { renderToString } = await import("react-dom/server");
    const { hydrateRoot } = await import("react-dom/client");
    const container = document.createElement("div");
    document.body.append(container);
    container.innerHTML = renderToString(<MenuApp menu={sectioned} orders={[]} submit={vi.fn()} />);
    // Num celular lento, a pessoa digita antes de o React assumir a página.
    container.querySelector<HTMLInputElement>('input[type="search"]')!.value = "agua";
    const root = await act(async () =>
      hydrateRoot(container, <MenuApp menu={sectioned} orders={[]} submit={vi.fn()} />),
    );
    expect(
      within(container)
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(["Água"]);
    act(() => root.unmount());
    container.remove();
  });
});

describe("mais pratos por tela e carrinho sempre à vista (spec 016, US2 e US3)", () => {
  it('"+" do Suco põe 1 no carrinho e anuncia o total; o do X-Burger abre o prato', () => {
    render(<MenuApp menu={menu} orders={[]} submit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pôr Suco no carrinho" }));
    expect(screen.getByRole("status", { name: "Carrinho" }).textContent).toBe(
      "Suco no carrinho. Total R$ 9,00",
    );
    fireEvent.click(screen.getByRole("button", { name: "Pôr Suco no carrinho" }));
    expect(screen.getByRole("status", { name: "Carrinho" }).textContent).toBe(
      "Suco no carrinho. Total R$ 18,00",
    );
    fireEvent.click(screen.getByRole("button", { name: "Pôr X-Burger no carrinho" }));
    expect(screen.getByRole("region", { name: "X-Burger" })).toBeTruthy();
  });

  it("o prato posto pela tela do prato também é anunciado", () => {
    render(<MenuApp menu={menu} orders={[]} submit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pôr X-Burger no carrinho" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ao pedido" }));
    expect(screen.getByRole("status", { name: "Carrinho" }).textContent).toBe(
      "X-Burger no carrinho. Total R$ 28,00",
    );
  });

  it("a linha que mudou fica destacada por 600 ms", () => {
    vi.useFakeTimers();
    try {
      render(<MenuApp menu={menu} orders={[]} submit={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: "Pôr Suco no carrinho" }));
      const line = () => screen.getByTestId("cart-panel").querySelector("li")!;
      expect(line().hasAttribute("data-highlight")).toBe(true);
      act(() => vi.advanceTimersByTime(600));
      expect(line().hasAttribute("data-highlight")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cardápio e carrinho lado a lado na tela larga: 3 colunas e depois 4; barra no pé na estreita", () => {
    render(<MenuApp menu={{ ...menu, showSectionTitles: false }} orders={[]} submit={vi.fn()} />);
    const list = screen.getByRole("list", { name: "Cardápio" });
    expect(list.className).toContain("grid-cols-1");
    expect(list.className).toContain("tab:grid-cols-3");
    expect(list.className).toContain("xl:grid-cols-4");
    expect(screen.getByTestId("menu-layout").className).toContain("lg:grid-cols-[minmax(0,1fr)_320px]");
    expect(screen.queryByTestId("cart-bar")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Pôr Suco no carrinho" }));
    expect(screen.getByRole("button", { name: "Ver pedido · 1 item · R$ 9,00" })).toBeTruthy();
  });
});

describe("topo com logo e capa (spec 016, US1)", () => {
  it("o cardápio de verdade mostra a capa, o logo, o nome e a mesa", () => {
    const appearance = {
      logo: { base: "/l", widths: [96] },
      cover: { base: "/c", widths: [600] },
    };
    render(<MenuApp menu={{ ...menu, appearance }} orders={[]} submit={vi.fn()} />);
    const banner = screen.getByRole("banner");
    expect(banner.querySelector("img[data-cover]")).toBeTruthy();
    expect(within(banner).getByRole("img", { name: "Logo de Cantina da Nona" })).toBeTruthy();
    expect(within(banner).getByRole("heading", { level: 1 }).textContent).toBe("Mesa 5");
  });

  it("a pré-visualização mostra o mesmo topo, com Cardápio no lugar da mesa", () => {
    render(
      <MenuApp
        preview
        menu={{
          showSectionTitles: false,
          sections: menu.sections,
          restaurantName: "Cantina da Nona",
          appearance: { logo: null, cover: { base: "/c", widths: [600] } },
        }}
      />,
    );
    const banner = screen.getByRole("banner");
    expect(within(banner).getByRole("heading", { level: 1 }).textContent).toBe("Cardápio");
    expect(within(banner).getByText("Cantina da Nona")).toBeTruthy();
  });
});

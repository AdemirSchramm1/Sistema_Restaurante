// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MenuApp } from "./menu-app";
import type { MenuView } from "@/application/ordering/menu";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(cleanup);

const menu: MenuView = {
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
    expect(screen.getByText("R$ 28,00")).toBeTruthy();
  });

  it("cada prato é um cartão, com o preço em destaque (spec 012)", () => {
    render(<MenuApp menu={menu} orders={[]} submit={vi.fn()} />);
    const items = within(screen.getByRole("list", { name: "Cardápio" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    for (const item of items) expect(item.className).toContain("bg-card");
    const price = within(items[1]!).getByText("R$ 28,00");
    expect(price.className).toContain("text-primary");
    expect(price.className).toContain("font-semibold");
  });

  it("produto sem opções vai direto para o pedido", () => {
    render(<MenuApp menu={menu} orders={[]} submit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Suco" }));
    expect(screen.getByTestId("cart-total").textContent).toBe("R$ 9,00");
  });

  it("produto com opções abre a tela do prato", () => {
    render(<MenuApp menu={menu} orders={[]} submit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar X-Burger" }));
    const dish = screen.getByRole("region", { name: "X-Burger" });
    fireEvent.click(within(dish).getByRole("button", { name: "Sem cebola" }));
    fireEvent.click(within(dish).getByRole("button", { name: "Adicionar ao pedido" }));
    expect(screen.getByTestId("cart-total").textContent).toBe("R$ 28,00");
    expect(screen.getAllByRole("listitem").some((li) => li.textContent === "SEM cebola")).toBe(true);
  });

  it("busca pelo nome sem acento", () => {
    render(<MenuApp menu={menu} orders={[]} submit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Buscar no cardápio"), { target: { value: "burg" } });
    expect(screen.queryByRole("button", { name: "Adicionar Suco" })).toBeNull();
    expect(screen.getByRole("button", { name: "Adicionar X-Burger" })).toBeTruthy();
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
  screen.getAllByRole("button", { name: /^Adicionar / }).map((b) => b.getAttribute("aria-label"));

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
    expect(lanches.className).toContain("sm:grid-cols-2");
    expect(lanches.className).toContain("lg:grid-cols-3");
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
    expect(screen.getAllByRole("img").map((i) => [i.getAttribute("alt"), i.getAttribute("loading")])).toEqual(
      [
        ["X-Burger", "eager"],
        ["X-Bacon", "eager"],
        ["Suco", "lazy"],
        ["Pudim", "lazy"],
      ],
    );
  });

  it("a busca procura em todas as seções e mantém a ordem do cardápio, sem títulos", () => {
    render(<MenuApp menu={sectioned} orders={[]} submit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Buscar no cardápio"), { target: { value: "u" } });
    expect(buttons()).toEqual(["Adicionar X-Burger", "Adicionar Suco", "Adicionar Água", "Adicionar Pudim"]);
    expect(screen.queryByRole("navigation", { name: "Seções do cardápio" })).toBeNull();
    expect(screen.queryByRole("heading", { level: 2, name: "Lanches" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Buscar no cardápio"), { target: { value: "zzz" } });
    expect(screen.getByText("Nada com esse nome.")).toBeTruthy();
  });

  it("tocar no nome abre a tela do prato com a descrição inteira, mesmo sem opções", () => {
    render(<MenuApp menu={sectioned} orders={[]} submit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver X-Burger" }));
    const dish = screen.getByRole("region", { name: "X-Burger" });
    expect(within(dish).getByText(/Pão, carne e queijo/).textContent).toBe(
      "Pão, carne e queijo.\nFeito na hora.",
    );
    fireEvent.click(within(dish).getByRole("button", { name: "Adicionar ao pedido" }));
    expect(screen.getByTestId("cart-total").textContent).toBe("R$ 10,00");
  });

  it("a atualização automática troca foto e ordem sem perder o carrinho", () => {
    const view = render(<MenuApp menu={sectioned} orders={[]} submit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Suco" }));
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
    expect(buttons().slice(0, 2)).toEqual(["Adicionar Água", "Adicionar Suco"]);
    expect(screen.getByRole("img", { name: "Água" }).getAttribute("src")).toBe("/fotos/menu/nova/300.webp");
    expect(screen.queryByRole("img", { name: "Suco" })).toBeNull();
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
    vi.unstubAllGlobals();
  });
});

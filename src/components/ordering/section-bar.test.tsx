// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { SectionBar, sectionAnchor } from "./section-bar";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Barra de seções do cardápio do cliente (spec 013, US6.1). */
const sections = [
  { id: "s1", name: "Entradas" },
  { id: "s2", name: "Lanches" },
  { id: null, name: "Outros" },
];

describe("barra de seções", () => {
  it("nav com um link por seção para a âncora do título", () => {
    render(<SectionBar sections={sections} current={null} />);
    const nav = screen.getByRole("navigation", { name: "Seções do cardápio" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Entradas", "#secao-s1"],
      ["Lanches", "#secao-s2"],
      ["Outros", "#secao-outros"],
    ]);
    for (const a of links) expect(a.className).toContain("min-h-11");
    expect(links.every((a) => !a.hasAttribute("aria-current"))).toBe(true);
  });

  it("fica presa no topo e rola para o lado só dentro dela", () => {
    render(<SectionBar sections={sections} current={null} />);
    const nav = screen.getByRole("navigation");
    expect(nav.className).toContain("sticky");
    expect(nav.className).toContain("top-0");
    expect(nav.querySelector("ul")!.className).toContain("overflow-x-auto");
  });

  it("a seção atual vem marcada com aria-current", () => {
    render(<SectionBar sections={sections} current="s2" />);
    const current = screen.getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "true");
    expect(current.map((a) => a.textContent)).toEqual(["Lanches"]);
  });

  it("Outros também pode ser a atual", () => {
    render(<SectionBar sections={sections} current="outros" />);
    expect(screen.getByRole("link", { name: "Outros" }).getAttribute("aria-current")).toBe("true");
  });

  it("âncora da seção: o id dela, ou outros", () => {
    expect([sectionAnchor("s1"), sectionAnchor(null)]).toEqual(["secao-s1", "secao-outros"]);
  });
});

/** ResizeObserver falso: o teste diz quando a barra mudou de tamanho. */
function fakeResize() {
  let fire = () => {};
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: () => void) {
        fire = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
  return () => act(() => fire());
}
/** Põe cada aba numa linha: `perRow` abas por linha. */
const rows = (perRow: number) =>
  screen
    .getAllByRole("listitem")
    .forEach((li, i) =>
      Object.defineProperty(li, "offsetTop", { configurable: true, value: Math.floor(i / perRow) * 52 }),
    );

describe("abas em até 2 linhas a partir de 600 px (spec 016, US2-5)", () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, name: `Seção ${i}` }));

  it("quebra em linhas no tablet; no celular, uma linha que rola", () => {
    fakeResize();
    render(<SectionBar sections={many} current={null} />);
    const ul = screen.getByRole("navigation").querySelector("ul")!;
    expect(ul.dataset.wrap).toBe("true");
    expect(ul.className).toContain("tab:flex-wrap");
    expect(ul.className).toContain("overflow-x-auto");
  });

  it("com 2 linhas continua quebrando; passando de 2, vira uma linha que rola sem cortar nome", () => {
    const resize = fakeResize();
    render(<SectionBar sections={many} current={null} />);
    const ul = screen.getByRole("navigation").querySelector("ul")!;
    rows(5);
    resize();
    expect(ul.dataset.wrap).toBe("true");
    rows(4);
    resize();
    expect(ul.dataset.wrap).toBe("false");
    expect(ul.className).not.toContain("tab:flex-wrap");
    for (const a of screen.getAllByRole("link")) expect(a.className).toContain("whitespace-nowrap");
  });

  it("sem ResizeObserver (navegador antigo) fica quebrando", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    render(<SectionBar sections={many} current={null} />);
    expect(screen.getByRole("navigation").querySelector("ul")!.dataset.wrap).toBe("true");
  });
});

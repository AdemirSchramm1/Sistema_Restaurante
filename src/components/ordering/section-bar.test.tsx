// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { SectionBar, sectionAnchor } from "./section-bar";

afterEach(cleanup);

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

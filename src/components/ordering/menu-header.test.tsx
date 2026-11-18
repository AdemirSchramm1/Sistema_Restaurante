// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MenuHeader } from "./menu-header";

afterEach(cleanup);

const logo = { base: "/fotos/menu/logo", widths: [96, 192, 384] };
const cover = { base: "/fotos/menu/capa", widths: [600, 1200, 1920] };

describe("topo do cardápio com a cara do restaurante (spec 016, US1-2 a US1-5)", () => {
  it("com capa: foto com as variantes, camada escura e o texto em branco embaixo", () => {
    render(<MenuHeader restaurantName="Cantina da Nona" title="Mesa 12" appearance={{ logo, cover }} />);
    const banner = screen.getByRole("banner");
    const img = banner.querySelector<HTMLImageElement>("img[data-cover]")!;
    expect(img.getAttribute("srcset")).toBe(
      "/fotos/menu/capa/600.webp 600w, /fotos/menu/capa/1200.webp 1200w, /fotos/menu/capa/1920.webp 1920w",
    );
    expect(img.getAttribute("alt")).toBe("");
    expect(img.getAttribute("fetchpriority")).toBe("high");
    expect(img.className).toContain("object-cover");
    const overlay = banner.querySelector<HTMLElement>("[data-overlay]")!;
    expect(overlay.style.backgroundImage).toContain("linear-gradient");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Mesa 12");
    expect(screen.getByText("Cantina da Nona").className).toContain("text-on-photo");
    expect(screen.getByRole("heading", { level: 1 }).className).toContain("text-on-photo");
  });

  it("altura de 120 px no celular e 160 px a partir de 600 px", () => {
    render(<MenuHeader restaurantName="Cantina" title="Mesa 12" appearance={{ logo, cover }} />);
    const banner = screen.getByRole("banner");
    expect(banner.className).toContain("h-30");
    expect(banner.className).toContain("tab:h-40");
  });

  it("logo quadrado com cantos arredondados, com o nome do restaurante", () => {
    render(
      <MenuHeader restaurantName="Cantina da Nona" title="Mesa 12" appearance={{ logo, cover: null }} />,
    );
    const img = screen.getByRole("img", { name: "Logo de Cantina da Nona" });
    expect(img.getAttribute("srcset")).toContain("192w");
    expect(img.className).toContain("aspect-square");
    expect(img.className).toContain("rounded-lg");
  });

  it("sem capa usa a cor principal; sem logo só o nome", () => {
    render(<MenuHeader restaurantName="Cantina" title="Mesa 12" appearance={{ logo: null, cover: null }} />);
    const banner = screen.getByRole("banner");
    expect(banner.className).toContain("bg-primary");
    expect(banner.querySelector("img")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).className).toContain("text-primary-foreground");
  });

  it("o que vem dentro (o tempo do acesso) fica embaixo do topo", () => {
    render(
      <MenuHeader restaurantName="Cantina" title="Mesa 12" appearance={{ logo: null, cover: null }}>
        <p>Faltam 18 min</p>
      </MenuHeader>,
    );
    expect(screen.getByRole("banner").contains(screen.getByText("Faltam 18 min"))).toBe(false);
  });
});

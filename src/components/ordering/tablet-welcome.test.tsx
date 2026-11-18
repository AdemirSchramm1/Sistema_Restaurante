// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TabletWelcome } from "./tablet-welcome";

afterEach(cleanup);

const logo = { base: "/fotos/menu/logo", widths: [96, 192, 384] };
const cover = { base: "/fotos/menu/capa", widths: [600, 1200, 1920] };

describe("boas-vindas do tablet (spec 016, US5-1)", () => {
  it("capa e logo em tela cheia, 'Mesa 12' e o botão grande Ver o cardápio", () => {
    const onStart = vi.fn();
    render(
      <TabletWelcome restaurantName="Cantina da Nona" tableName="12" appearance={{ logo, cover }} onStart={onStart} />,
    );
    const main = screen.getByRole("region", { name: "Boas-vindas" });
    expect(main.className).toContain("min-h-dvh");
    expect(main.querySelector("img[data-cover]")!.getAttribute("srcset")).toContain("1920w");
    expect(screen.getByRole("img", { name: "Logo de Cantina da Nona" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Mesa 12");
    expect(screen.getByText("Cantina da Nona").className).toContain("text-on-photo");
    const start = screen.getByRole("button", { name: "Ver o cardápio" });
    expect(start.className).toContain("h-16");
    fireEvent.click(start);
    expect(onStart).toHaveBeenCalled();
  });

  it("sem capa e sem logo: a cor principal e o nome", () => {
    render(
      <TabletWelcome restaurantName="Cantina" tableName="4" appearance={{ logo: null, cover: null }} onStart={() => {}} />,
    );
    const main = screen.getByRole("region", { name: "Boas-vindas" });
    expect(main.className).toContain("bg-primary");
    expect(main.querySelector("img")).toBeNull();
    expect(screen.getByText("Cantina").className).toContain("text-primary-foreground");
  });
});

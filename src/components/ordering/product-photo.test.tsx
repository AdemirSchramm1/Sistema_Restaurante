// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CARD_SIZES, ProductPhoto } from "./product-photo";

afterEach(cleanup);

/** Foto do produto no cardápio do cliente (spec 013, US6.3 e US6.10; research R5). */
const photo = { base: "/fotos/menu/abc", widths: [300, 600, 900] };

describe("foto do produto", () => {
  it("img com srcset das larguras, sizes, 4:3 e o nome do produto no alt", () => {
    render(<ProductPhoto photo={photo} name="X-Burger" />);
    const img = screen.getByRole("img", { name: "X-Burger" });
    expect(img.getAttribute("srcset")).toBe(
      "/fotos/menu/abc/300.webp 300w, /fotos/menu/abc/600.webp 600w, /fotos/menu/abc/900.webp 900w",
    );
    expect(img.getAttribute("sizes")).toBe(CARD_SIZES);
    // Sem srcset (navegador antigo), vai a menor.
    expect(img.getAttribute("src")).toBe("/fotos/menu/abc/300.webp");
    expect([img.getAttribute("width"), img.getAttribute("height")]).toEqual(["400", "300"]);
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("decoding")).toBe("async");
    expect(img.hasAttribute("data-photo")).toBe(true);
    expect(img.className).toContain("aspect-[4/3]");
    expect(img.className).toContain("object-cover");
  });

  it("as primeiras da tela vêm sem espera (eager)", () => {
    render(<ProductPhoto photo={photo} name="X-Burger" eager />);
    expect(screen.getByRole("img").getAttribute("loading")).toBe("eager");
  });

  it("na tela do prato a foto ocupa a largura toda: outro sizes", () => {
    render(<ProductPhoto photo={photo} name="X-Burger" sizes="(min-width: 640px) 640px, 100vw" />);
    expect(screen.getByRole("img").getAttribute("sizes")).toBe("(min-width: 640px) 640px, 100vw");
  });

  it("sem foto não desenha nada", () => {
    const { container } = render(<ProductPhoto photo={null} name="Suco" />);
    expect(container.innerHTML).toBe("");
  });
});

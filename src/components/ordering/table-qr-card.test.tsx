// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TableQrCard } from "./table-qr-card";

afterEach(cleanup);

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 37 37"><path d="M0 0h1"/></svg>';
const props = {
  restaurantName: "Cantina da Nona",
  table: { id: "t1", name: "12", url: "https://app/m/abc", svg, version: 3 },
  rotateAction: async () => null,
};

describe("QR code da mesa (spec 009, US1)", () => {
  it("mostra o desenho com o nome do restaurante e 'Mesa 12'", () => {
    render(<TableQrCard {...props} />);
    expect(screen.getByRole("img", { name: "QR code da Mesa 12" }).innerHTML).toContain("<svg");
    expect(screen.getByText("Cantina da Nona")).toBeTruthy();
    expect(screen.getByText("Mesa 12")).toBeTruthy();
  });

  it("'Baixar imagem' baixa o SVG com o nome da mesa", () => {
    render(<TableQrCard {...props} />);
    const link = screen.getByRole("link", { name: "Baixar imagem" });
    expect(link.getAttribute("download")).toBe("mesa-12.svg");
    expect(decodeURIComponent(link.getAttribute("href")!)).toContain("<svg");
  });

  it("'Abrir o cardápio' leva ao link do QR code, para testar sem celular", () => {
    render(<TableQrCard {...props} />);
    const link = screen.getByRole("link", { name: "Abrir o cardápio da Mesa 12" });
    expect(link.getAttribute("href")).toBe("https://app/m/abc");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("'Trocar QR code' pede confirmação antes de trocar", () => {
    render(<TableQrCard {...props} />);
    expect(screen.queryByRole("button", { name: "Sim, trocar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Trocar QR code" }));
    expect(screen.getByText(/O QR code impresso nesta mesa vai parar de funcionar/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sim, trocar" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("button", { name: "Sim, trocar" })).toBeNull();
  });

  it("na folha de impressão não mostra os botões", () => {
    render(<TableQrCard {...props} rotateAction={undefined} />);
    expect(screen.queryByRole("button", { name: "Trocar QR code" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Abrir o cardápio/ })).toBeNull();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { BarList, PairedBars } from "./bar-list";
import { d } from "@/domain/shared/decimal";

afterEach(cleanup);

const width = (el: HTMLElement) => el.style.width;

describe("gráfico de barras (spec 006, FR-007)", () => {
  it("mostra rótulo, valor e barra proporcional ao maior", () => {
    render(
      <BarList
        title="Itens que mais saíram"
        rows={[
          { key: "a", label: "Carne", amount: d(300), valueText: "R$ 300,00", detail: "10 kg" },
          { key: "b", label: "Tomate", amount: d(150), valueText: "R$ 150,00", href: "/estoque/itens/b" },
        ]}
      />,
    );
    const list = screen.getByRole("list", { name: "Itens que mais saíram" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toContain("Carne");
    expect(items[0]!.textContent).toContain("R$ 300,00");
    expect(items[0]!.textContent).toContain("10 kg");
    expect(width(within(items[0]!).getByTestId("bar"))).toBe("100%");
    expect(width(within(items[1]!).getByTestId("bar"))).toBe("50%");
    expect(within(items[1]!).getByRole("link", { name: "Tomate" }).getAttribute("href")).toBe(
      "/estoque/itens/b",
    );
  });

  it("a barra usa uma das cores de gráfico do tema (spec 012)", () => {
    const rows = [{ key: "a", label: "Carne", amount: d(1), valueText: "R$ 1,00" }];
    const { unmount } = render(<BarList title="Padrão" rows={rows} />);
    expect(screen.getByTestId("bar").className).toContain("bg-chart-1");
    unmount();
    render(<BarList title="Mirtilo" rows={rows} color={4} />);
    expect(screen.getByTestId("bar").className).toContain("bg-chart-4");
  });

  it("sem dados diz que não há nada no período", () => {
    render(<BarList title="Saídas por motivo" rows={[]} />);
    expect(screen.getByText("Nada no período.")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("entradas e saídas por semana usam a mesma escala", () => {
    render(
      <PairedBars
        title="Entradas e saídas por semana"
        firstLabel="Entradas"
        secondLabel="Saídas"
        rows={[
          {
            key: "w1",
            label: "27/10",
            first: d(200),
            second: d(50),
            firstText: "R$ 200,00",
            secondText: "R$ 50,00",
          },
          {
            key: "w2",
            label: "03/11",
            first: d(0),
            second: d(100),
            firstText: "R$ 0,00",
            secondText: "R$ 100,00",
          },
        ]}
      />,
    );
    const items = within(screen.getByRole("list", { name: "Entradas e saídas por semana" })).getAllByRole(
      "listitem",
    );
    const bars = (i: number) => within(items[i]!).getAllByTestId("bar").map(width);
    expect(bars(0)).toEqual(["100%", "25%"]);
    const colors = within(items[0]!)
      .getAllByTestId("bar")
      .map((b) => b.className.match(/bg-chart-\d/)?.[0]);
    expect(colors).toEqual(["bg-chart-1", "bg-chart-2"]);
    expect(bars(1)).toEqual(["0%", "50%"]);
    expect(items[0]!.textContent).toContain("Entradas: R$ 200,00");
    expect(items[0]!.textContent).toContain("Saídas: R$ 50,00");
  });
});

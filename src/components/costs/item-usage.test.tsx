// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ItemUsage } from "./item-usage";
import { d } from "@/domain/shared/decimal";

afterEach(cleanup);

describe("quadro 'Usado nos produtos' do item (spec 008, US3)", () => {
  it("lista os produtos com custo e a % do preço; preparo sem preço", () => {
    render(
      <ItemUsage
        rows={[
          {
            id: "m",
            name: "Molho de tomate",
            kind: "SUB_RECIPE",
            cost: d("21"),
            salePrice: null,
            share: null,
          },
          { id: "x", name: "X-Burger", kind: "DISH", cost: d("8.5"), salePrice: d(28), share: d("30.357") },
          { id: "p", name: "Pizza", kind: "DISH", cost: null, salePrice: d(40), share: null },
        ]}
      />,
    );
    const list = screen.getByRole("list", { name: "Usado nos produtos" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringContaining("Molho de tomate (preparo)"),
      expect.stringContaining("30,4% do preço"),
      expect.stringContaining("sem custo ainda"),
    ]);
    expect(items[0]!.textContent).toContain("R$ 21,00");
    expect(items[1]!.textContent).toContain("R$ 8,50");
    expect(within(items[1]!).getByRole("link", { name: "X-Burger" }).getAttribute("href")).toBe(
      "/estoque/produtos/x",
    );
  });

  it("item fora de todos os produtos diz isso", () => {
    render(<ItemUsage rows={[]} />);
    expect(screen.getByText("Este item ainda não entra em nenhum produto.")).toBeTruthy();
  });
});

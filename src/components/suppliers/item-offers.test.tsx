// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { OfferView } from "@/application/suppliers/suppliers";
import { d } from "@/domain/shared/decimal";
import { ItemOffers } from "./item-offers";

afterEach(cleanup);

const offer = (over: Partial<OfferView>): OfferView => ({
  id: "o1",
  supplierId: "s1",
  supplierName: "Hortifruti do João",
  supplierActive: true,
  itemId: "i1",
  itemCode: "01.01.0001",
  itemName: "Tomate",
  itemActive: true,
  stockUnit: "kg",
  packageLabel: "Caixa",
  packageQuantity: d(18),
  price: d("90.5"),
  preferred: false,
  version: 1,
  priceUpdatedAt: new Date("2026-11-01T12:00:00Z"),
  lastPurchase: null,
  pricePerUnit: d("5.0278"),
  cheapest: false,
  ...over,
});
const cells = (row: number) =>
  within(screen.getAllByRole("row")[row]!)
    .getAllByRole("cell")
    .map((c) => c.textContent?.replace(/\s+/g, " ").trim());

describe("quem vende o item (spec 007, US3)", () => {
  it("sem oferta, manda cadastrar na página do fornecedor", () => {
    render(<ItemOffers offers={[]} unit="kg" timezone="America/Sao_Paulo" />);
    expect(screen.getByRole("link", { name: "fornecedor" }).getAttribute("href")).toBe(
      "/estoque/fornecedores",
    );
  });

  it("mostra embalagem, preço, preço por medida, selos e a última compra no fuso do restaurante", () => {
    render(
      <ItemOffers
        offers={[
          offer({
            preferred: true,
            cheapest: true,
            lastPurchase: { at: new Date("2026-11-02T01:30:00Z"), unitCost: d("4.9") },
          }),
          offer({
            id: "o2",
            supplierId: "s2",
            supplierName: "Ceasa",
            supplierActive: false,
            packageLabel: null,
            packageQuantity: null,
            price: d("6.12345"),
            pricePerUnit: d("6.12345"),
          }),
        ]}
        unit="kg"
        timezone="America/Sao_Paulo"
      />,
    );
    expect(cells(1)).toEqual([
      "Hortifruti do João Preferido mais barato",
      "Caixa de 18 kg",
      "R$ 90,50",
      "R$ 5,03/kg",
      "01/11/2026: R$ 4,90/kg",
    ]);
    expect(cells(2)).toEqual(["Ceasa bloqueado", "Solto (por kg)", "R$ 6,1235", "R$ 6,12/kg", "—"]);
    expect(screen.getByRole("link", { name: "Ceasa" }).getAttribute("href")).toBe("/estoque/fornecedores/s2");
  });
});

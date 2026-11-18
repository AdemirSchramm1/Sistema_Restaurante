// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TabletPreview } from "./tablet-preview";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(cleanup);

const menu = {
  restaurantName: "Cantina da Nona",
  appearance: { logo: null, cover: null },
  showSectionTitles: false,
  sections: [
    {
      id: null,
      name: "Outros",
      products: [
        { id: "s", name: "Suco", price: "9.00", description: null, photo: null, addons: [], removables: [] },
      ],
    },
  ],
};

describe("pré-visualização do tablet da mesa (spec 016)", () => {
  it("abre nas boas-vindas e mostra o cardápio sem prazo e sem enviar", () => {
    render(<TabletPreview menu={menu} />);
    expect(screen.getByRole("region", { name: "Boas-vindas" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Mesa 12");
    fireEvent.click(screen.getByRole("button", { name: "Ver o cardápio" }));
    expect(screen.queryByRole("region", { name: "Boas-vindas" })).toBeNull();
    expect(screen.getByText("Pré-visualização: pedidos não são enviados")).toBeTruthy();
    expect(screen.queryByText(/Faltam/)).toBeNull();
  });
});

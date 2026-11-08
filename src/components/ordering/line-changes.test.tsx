// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LineChanges } from "./line-changes";

afterEach(cleanup);

describe("mudanças da linha para a cozinha (spec 010, US4)", () => {
  it("mostra '+ 2 Fatia de queijo' e 'SEM cebola' com destaque que não depende só de cor", () => {
    render(<LineChanges changes={["+ 2 Fatia de queijo", "SEM cebola"]} />);
    const items = screen.getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual(["+ 2 Fatia de queijo", "SEM cebola"]);
    const without = items[1]!.querySelector("strong");
    expect(without?.textContent).toBe("SEM");
  });

  it("sem mudanças não mostra nada", () => {
    const { container } = render(<LineChanges changes={[]} />);
    expect(container.innerHTML).toBe("");
  });
});

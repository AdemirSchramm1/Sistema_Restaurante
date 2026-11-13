// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NoAccess } from "./no-access";

afterEach(cleanup);

describe("tela sem acesso (spec 009)", () => {
  it("diz o que aconteceu e o que fazer, com o título que os testes de ponta a ponta procuram", () => {
    render(<NoAccess />);
    expect(screen.getByRole("heading", { level: 1, name: "Sem acesso" })).toBeTruthy();
    expect(screen.getByText(/Escolha outra no menu ou fale com o gerente\./)).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/caixa/contas" }));

afterEach(cleanup);

function shell() {
  return render(
    <AppShell
      restaurantName="Cantina da Ana"
      userName="Ana"
      roles={["MANAGER", "CASHIER"]}
      reorderCount={2}
      signOut={async () => {}}
    >
      <h1>Contas fechadas</h1>
    </AppShell>,
  );
}

describe("casco da tela (spec 012, US2)", () => {
  it("tem o link para pular o menu e o conteúdo no main", () => {
    shell();
    const skip = screen.getByRole("link", { name: "Pular para o conteúdo" });
    expect(skip.getAttribute("href")).toBe("#conteudo");
    const main = screen.getByRole("main");
    expect(main.id).toBe("conteudo");
    expect(within(main).getByRole("heading", { name: "Contas fechadas" })).toBeTruthy();
  });

  it("mostra o restaurante, quem está logado com os papéis e o botão Sair", () => {
    shell();
    expect(screen.getByText("Cantina da Ana")).toBeTruthy();
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("Gerente, Caixa")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sair" })).toBeTruthy();
  });

  it("Sair apaga do aparelho os carrinhos não enviados do garçom (spec 015, FR-022)", () => {
    localStorage.setItem("garcom:v1:r1:u1:m12", "{}");
    localStorage.setItem("garcom:modo", "lista");
    shell();
    fireEvent.submit(screen.getByRole("button", { name: "Sair" }).closest("form")!);
    expect(localStorage.getItem("garcom:v1:r1:u1:m12")).toBeNull();
    expect(localStorage.getItem("garcom:modo")).toBe("lista");
  });

  it("o menu destaca a tela do endereço atual e mostra a contagem do Repor", () => {
    shell();
    const nav = screen.getByRole("navigation", { name: "Menu principal" });
    expect(within(nav).getByRole("link", { name: "Contas" }).getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByLabelText("2 itens para repor")).toBeTruthy();
  });

  it("no celular, o botão Menu abre e fecha a lista", () => {
    shell();
    const button = screen.getByRole("button", { name: "Menu" });
    const panel = document.getElementById(button.getAttribute("aria-controls") ?? "");
    expect(panel).not.toBeNull();
    expect(within(panel!).getByRole("navigation", { name: "Menu principal" })).toBeTruthy();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("escolher uma tela fecha o menu", () => {
    shell();
    const button = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("link", { name: "Itens" }));
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("Esc fecha o menu e devolve o foco ao botão", () => {
    shell();
    const button = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole("link", { name: "Itens" }), { key: "Escape" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
  });

  it("outra tecla, ou Esc com o menu fechado, não mexe no menu", () => {
    shell();
    const button = screen.getByRole("button", { name: "Menu" });
    const link = screen.getByRole("link", { name: "Itens" });
    fireEvent.keyDown(link, { key: "Escape" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).not.toBe(button);
    fireEvent.click(button);
    fireEvent.keyDown(link, { key: "Enter" });
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });

  it("sem restaurante ainda, a marca é só o nome do produto", () => {
    render(
      <AppShell
        restaurantName={null}
        userName={null}
        roles={["MANAGER"]}
        reorderCount={0}
        signOut={async () => {}}
      >
        <h1>Início</h1>
      </AppShell>,
    );
    const brand = screen.getByRole("complementary");
    expect(within(brand).getAllByText("Sistema Restaurante")).toHaveLength(1);
  });
});

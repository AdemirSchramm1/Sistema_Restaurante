// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HistoryList } from "./history-list";

afterEach(cleanup);

const entry = (changes: Record<string, [unknown, unknown]>) => ({
  entity: "item",
  entityId: "i1",
  action: "UPDATE" as const,
  changes,
  userId: "u1",
  userName: "Ana",
  occurredAt: new Date("2026-11-01T17:30:00Z"),
});

describe("histórico (FR-004)", () => {
  it("mostra o nome do campo em português e números com vírgula", () => {
    render(
      <HistoryList
        timezone="America/Sao_Paulo"
        entries={[
          entry({
            description: ["Tomate", "Tomate italiano"],
            purchaseUnitLabel: [null, "Caixa"],
            purchaseFactor: [null, "12.5"],
            stockUnit: ["kg", "un"],
          }),
        ]}
      />,
    );
    expect(screen.getByText("Nome do item: Tomate → Tomate italiano")).toBeTruthy();
    expect(screen.getByText("Embalagem: — → Caixa")).toBeTruthy();
    expect(screen.getByText("Quanto vem na embalagem: — → 12,5")).toBeTruthy();
    expect(screen.getByText("Medida: kg → un")).toBeTruthy();
  });

  it("mostra o aviso de reposição em português (spec 006)", () => {
    render(
      <HistoryList
        timezone="America/Sao_Paulo"
        entries={[entry({ reorderPoint: [null, "20"], parLevel: ["40", "50.5"] })]}
      />,
    );
    expect(screen.getByText("Avisar quando chegar em: — → 20")).toBeTruthy();
    expect(screen.getByText("Comprar até: 40 → 50,5")).toBeTruthy();
  });

  it("mostra o preço de venda em português (spec 008)", () => {
    render(<HistoryList timezone="America/Sao_Paulo" entries={[entry({ salePrice: [null, "28.00"] })]} />);
    expect(screen.getByText("Preço de venda: — → 28,00")).toBeTruthy();
  });

  it("campos antigos, já retirados do cadastro, ainda aparecem com nome em português", () => {
    render(
      <HistoryList
        timezone="America/Sao_Paulo"
        entries={[entry({ correctionFactor: ["1", "1.25"], lotControl: [false, true] })]}
      />,
    );
    expect(screen.getByText("Fator de correção: 1 → 1,25")).toBeTruthy();
    expect(screen.getByText("Controla lote: não → sim")).toBeTruthy();
  });

  it("traduz tipo e quem está no CMV; ids aparecem só como alterados", () => {
    render(
      <HistoryList
        timezone="America/Sao_Paulo"
        entries={[
          entry({
            type: ["INGREDIENT", "RESALE"],
            subgroupId: ["a", "b"],
            inCogsOverride: [null, false],
          }),
        ]}
      />,
    );
    expect(screen.getByText("Tipo: Ingrediente → Revenda")).toBeTruthy();
    expect(screen.getByText("Subgrupo: alterado")).toBeTruthy();
    expect(screen.getByText("Entra no CMV: segue o grupo → não")).toBeTruthy();
  });

  it("data e hora no fuso do restaurante", () => {
    render(<HistoryList timezone="America/Sao_Paulo" entries={[entry({ description: ["abc", "abcd"] })]} />);
    expect(screen.getByText(/01\/11\/2026, 14:30:00/)).toBeTruthy();
  });

  it("mostra as mudanças do produto em português (spec 003)", () => {
    render(
      <HistoryList
        timezone="America/Sao_Paulo"
        entries={[
          entry({
            kind: ["DISH", "SUB_RECIPE"],
            yield: [null, "2 kg"],
            lines: ["Pão: 1 un", "Pão: 2 un"],
          }),
        ]}
      />,
    );
    expect(
      screen.getByText("Tipo: Vendido ao cliente → Preparo (usado dentro de outros produtos)"),
    ).toBeTruthy();
    expect(screen.getByText("Quanto rende: — → 2 kg")).toBeTruthy();
    expect(screen.getByText("O que vai nele: Pão: 1 un → Pão: 2 un")).toBeTruthy();
  });
});

describe("histórico das mudanças de cardápio (spec 013, FR-009)", () => {
  const menuEntry = (action: "CREATE" | "UPDATE" | "DEACTIVATE", changes: Record<string, unknown>) => ({
    entity: "recipe",
    entityId: "r1",
    action,
    changes,
    userId: "u1",
    userName: "Bia",
    occurredAt: new Date("2026-11-01T17:30:00Z"),
  });
  const show = (action: "CREATE" | "UPDATE" | "DEACTIVATE", changes: Record<string, unknown>) => {
    render(<HistoryList timezone="America/Sao_Paulo" entries={[menuEntry(action, changes)]} />);
    return screen.getByRole("list", { name: "Histórico de alterações" }).textContent;
  };

  it("descrição e seção: diz que foi no cardápio e mostra antes e depois", () => {
    const text = show("UPDATE", {
      event: "menu.details",
      menuDescription: [null, "Feito na hora."],
      menuSection: ["Outros", "Bebidas"],
    });
    expect(text).toContain("Alterou no cardápio · Bia");
    expect(screen.getByText("Descrição no cardápio: — → Feito na hora.")).toBeTruthy();
    expect(screen.getByText("Seção do cardápio: Outros → Bebidas")).toBeTruthy();
  });

  it("foto: diz o que aconteceu sem mostrar o endereço do arquivo", () => {
    expect(show("UPDATE", { event: "menu.photo.set", photo: [null, "/fotos/menu/abc"] })).toContain(
      "Pôs foto no cardápio · Bia",
    );
    expect(screen.queryByText(/fotos\/menu/)).toBeNull();
    cleanup();
    expect(
      show("UPDATE", { event: "menu.photo.set", photo: ["/fotos/menu/abc", "/fotos/menu/def"] }),
    ).toContain("Trocou a foto do cardápio · Bia");
    cleanup();
    expect(show("UPDATE", { event: "menu.photo.remove", photo: ["/fotos/menu/abc", null] })).toContain(
      "Tirou a foto do cardápio · Bia",
    );
    expect(screen.queryByText(/fotos\/menu/)).toBeNull();
  });

  it("ordem do produto: mostra a posição antes e depois", () => {
    const text = show("UPDATE", {
      event: "menu.product.move",
      name: "X-Salada",
      section: "Lanches",
      menuPosition: [2, 1],
    });
    expect(text).toContain("Mudou a ordem no cardápio · Bia");
    expect(screen.getByText("Posição na seção: 2 → 1")).toBeTruthy();
  });

  it("seções: criar, renomear, mover e apagar", () => {
    expect(show("CREATE", { event: "menu.section.create", name: [null, "Doces"] })).toContain(
      "Criou a seção · Bia",
    );
    cleanup();
    expect(show("UPDATE", { event: "menu.section.rename", name: ["Doces", "Sobremesas"] })).toContain(
      "Renomeou a seção · Bia",
    );
    expect(screen.getByText("Nome: Doces → Sobremesas")).toBeTruthy();
    cleanup();
    expect(show("UPDATE", { event: "menu.section.move", position: [3, 2] })).toContain(
      "Mudou a ordem da seção · Bia",
    );
    expect(screen.getByText("Posição: 3 → 2")).toBeTruthy();
    cleanup();
    expect(show("DEACTIVATE", { event: "menu.section.delete", name: "Doces", movedProducts: 4 })).toContain(
      "Apagou a seção · Bia",
    );
  });

  it("evento que a tela não conhece cai no rótulo da ação", () => {
    expect(show("UPDATE", { event: "menu.futuro", salePrice: ["9.00", "10.00"] })).toContain("Alterou · Bia");
  });
});

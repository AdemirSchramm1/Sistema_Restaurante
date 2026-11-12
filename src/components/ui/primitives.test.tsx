// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Package } from "lucide-react";
import { Badge } from "./badge";
import { Alert } from "./alert";
import { Button, buttonVariants } from "./button";
import { Card, CardDescription, CardHeader, CardTitle } from "./card";
import { Table, Td, Th } from "./table";
import { TextLink } from "./text-link";
import { EmptyState } from "./empty-state";

afterEach(cleanup);

/** Componentes do padrão do front (spec 012, contracts/ui-components.md). */
describe("Badge: seis tons do tema", () => {
  it("cada tom usa o fundo suave e o texto da mesma cor; o padrão é neutro", () => {
    const tones = {
      neutral: ["bg-muted", "text-muted-foreground"],
      primary: ["bg-primary-soft", "text-primary-soft-foreground"],
      success: ["bg-success-soft", "text-success-soft-foreground"],
      warning: ["bg-warning-soft", "text-warning-soft-foreground"],
      danger: ["bg-danger-soft", "text-danger-soft-foreground"],
      info: ["bg-info-soft", "text-info-soft-foreground"],
    } as const;
    for (const [tone, classes] of Object.entries(tones)) {
      render(<Badge tone={tone as keyof typeof tones}>{tone}</Badge>);
      expect(screen.getByText(tone).className.split(" ")).toEqual(expect.arrayContaining([...classes]));
    }
    render(<Badge>sem tom</Badge>);
    expect(screen.getByText("sem tom").className).toContain("bg-muted");
  });
});

describe("Alert: quatro tipos fixos", () => {
  it("erro é anunciado como alerta; atenção, informação e deu certo como situação", () => {
    render(
      <>
        <Alert>Deu erro</Alert>
        <Alert tone="warning">Atenção</Alert>
        <Alert tone="info">Saiba</Alert>
        <Alert tone="success">Pronto</Alert>
      </>,
    );
    expect(screen.getByRole("alert").textContent).toContain("Deu erro");
    expect(screen.getAllByRole("status").map((s) => s.textContent)).toEqual(["Atenção", "Saiba", "Pronto"]);
  });

  it("mostra o ícone do tipo só como enfeite (o texto diz o que houve)", () => {
    render(<Alert tone="warning">Atenção</Alert>);
    const icon = screen.getByRole("status").querySelector("svg");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("status").className).toContain("bg-warning-soft");
  });
});

describe("Button: variantes e tamanhos do tema", () => {
  it("principal em páprica, destrutivo em beterraba, sucesso em manjericão", () => {
    expect(buttonVariants()).toContain("bg-primary");
    expect(buttonVariants({ variant: "destructive" })).toContain("bg-destructive");
    expect(buttonVariants({ variant: "destructive" })).toContain("text-destructive-foreground");
    expect(buttonVariants({ variant: "success" })).toContain("bg-success");
    expect(buttonVariants({ variant: "secondary" })).toContain("bg-secondary");
  });

  it("tamanho xl (48 px) para toque na cozinha e no caixa", () => {
    render(<Button size="xl">Começar preparo</Button>);
    expect(screen.getByRole("button", { name: "Começar preparo" }).className).toContain("h-12");
  });
});

describe("Card", () => {
  it("título é h2 por padrão e muda de nível com `as`", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Total da conta</CardTitle>
          <CardDescription>Subtotal, serviço e total</CardDescription>
        </CardHeader>
        <CardTitle as="h3">Pagamentos</CardTitle>
      </Card>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Total da conta" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Pagamentos" })).toBeTruthy();
    expect(screen.getByText("Subtotal, serviço e total").className).toContain("text-muted-foreground");
  });
});

describe("Table", () => {
  it("célula numérica alinha à direita com números tabulares", () => {
    render(
      <Table>
        <thead>
          <tr>
            <Th numeric>Total</Th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <Td numeric>R$ 10,00</Td>
          </tr>
        </tbody>
      </Table>,
    );
    for (const el of [screen.getByText("Total"), screen.getByText("R$ 10,00")])
      expect(el.className.split(" ")).toEqual(expect.arrayContaining(["text-right", "tabular-nums"]));
  });
});

describe("TextLink", () => {
  it("é um link com a cor e o sublinhado do padrão", () => {
    render(<TextLink href="/caixa/contas">Contas fechadas</TextLink>);
    const link = screen.getByRole("link", { name: "Contas fechadas" });
    expect(link.getAttribute("href")).toBe("/caixa/contas");
    expect(link.className).toContain("text-primary");
    expect(link.className).toContain("underline");
  });
});

describe("EmptyState", () => {
  it("mostra o título, a explicação e a ação; o ícone é enfeite", () => {
    render(
      <EmptyState
        icon={Package}
        title="Nenhum item ainda."
        action={<TextLink href="/estoque/itens/novo">Novo item</TextLink>}
      >
        Cadastre o primeiro item.
      </EmptyState>,
    );
    expect(screen.getByText("Nenhum item ainda.")).toBeTruthy();
    expect(screen.getByText("Cadastre o primeiro item.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Novo item" })).toBeTruthy();
    expect(document.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

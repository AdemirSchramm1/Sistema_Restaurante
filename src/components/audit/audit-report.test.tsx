// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { AuditReportPage, type AuditReportProps } from "./audit-report";

afterEach(cleanup);

const ANA = "0193a1b2-0000-7000-8000-00000000000a";
const ITEM = "0193a1b2-0000-7000-8000-0000000000f1";

const row = (over: Partial<AuditReportProps["rows"][number]> = {}) => ({
  id: "r1",
  entity: "item",
  entityId: ITEM,
  action: "UPDATE" as const,
  changes: { description: ["Tomate", "Tomate italiano"] } as Record<string, unknown>,
  userId: ANA,
  userName: "Ana",
  origin: { channel: "web" as const },
  occurredAt: new Date("2026-11-20T17:30:00Z"),
  ...over,
});

const props = (over: Partial<AuditReportProps> = {}): AuditReportProps => ({
  query: { de: "2026-11-20", ate: "2026-11-20", pessoa: "", tipo: "", negadas: false },
  people: [
    { userId: ANA, name: "Ana" },
    { userId: "0193a1b2-0000-7000-8000-00000000000b", name: "Bia (inativa)" },
  ],
  timezone: "America/Sao_Paulo",
  page: 1,
  total: 1,
  rows: [row()],
  error: null,
  ...over,
});

describe("Auditoria (spec 019, US1)", () => {
  it("lista quando, quem, o que (com link), a ação e o que mudou", () => {
    render(<AuditReportPage {...props()} />);
    const table = screen.getByRole("table", { name: "Registros da auditoria" });
    const cells = within(table)
      .getAllByRole("cell")
      .map((c) => c.textContent);
    expect(cells).toEqual([
      "20/11/2026, 14:30:00",
      "Ana",
      "Itens e gruposTomate italiano",
      "Alterou",
      "Nome do item: Tomate → Tomate italiano",
    ]);
    expect(within(table).getByRole("link", { name: "Tomate italiano" }).getAttribute("href")).toBe(
      `/estoque/itens/${ITEM}`,
    );
    expect(screen.getByText("1 registro")).toBeTruthy();
  });

  it("sem nome nem tela: tipo sem link; sem pessoa: Sistema ou cliente", () => {
    render(
      <AuditReportPage
        {...props({
          total: 2,
          rows: [
            row({ id: "a", entity: "membership", changes: {}, action: "DENIED", userName: "Ana" }),
            row({ id: "b", entity: "order", changes: {}, action: "CREATE", userId: null, userName: null }),
          ],
        })}
      />,
    );
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(
      rows.map((r) =>
        within(r)
          .getAllByRole("cell")
          .map((c) => c.textContent),
      ),
    ).toEqual([
      ["20/11/2026, 14:30:00", "Ana", "Equipe e acessos", "Tentou sem permissão", ""],
      ["20/11/2026, 14:30:00", "Cliente pelo QR code", "Pedidos", "Criou", ""],
    ]);
    expect(within(rows[1]!).getByRole("link", { name: "Ver pedido" }).getAttribute("href")).toBe(
      `/pedidos/${ITEM}`,
    );
    expect(within(rows[0]!).queryByRole("link")).toBeNull();
    expect(screen.getByText("2 registros")).toBeTruthy();
  });

  it("entidade sem tipo conhecido mostra o nome cru", () => {
    render(<AuditReportPage {...props({ rows: [row({ entity: "coisa_nova", changes: {} })] })} />);
    expect(screen.getByRole("cell", { name: "coisa_nova" })).toBeTruthy();
  });

  it("filtros com os valores do endereço e a planilha com o mesmo filtro", () => {
    render(
      <AuditReportPage
        {...props({
          query: { de: "2026-11-01", ate: "2026-11-20", pessoa: ANA, tipo: "STOCK", negadas: true },
        })}
      />,
    );
    const form = screen.getByRole("search");
    expect((within(form).getByLabelText("De") as HTMLInputElement).value).toBe("2026-11-01");
    expect((within(form).getByLabelText("Até") as HTMLInputElement).value).toBe("2026-11-20");
    const person = within(form).getByLabelText("Pessoa") as HTMLSelectElement;
    expect(person.value).toBe(ANA);
    expect([...person.options].map((o) => o.text)).toEqual(["Todas", "Ana", "Bia (inativa)"]);
    const type = within(form).getByLabelText("Tipo de operação") as HTMLSelectElement;
    expect(type.value).toBe("STOCK");
    expect(type.options).toHaveLength(12);
    expect(type.options[0]!.text).toBe("Todos");
    expect(type.options[4]!.text).toBe("Lançamentos de estoque");
    expect((within(form).getByLabelText("Só tentativas sem permissão") as HTMLInputElement).checked).toBe(
      true,
    );
    expect(screen.getByRole("link", { name: "Baixar planilha" }).getAttribute("href")).toBe(
      `/equipe/auditoria/planilha?de=2026-11-01&ate=2026-11-20&pessoa=${ANA}&tipo=STOCK&negadas=1`,
    );
  });

  it("período inválido: o problema aparece no campo De e não há lista", () => {
    render(<AuditReportPage {...props({ error: "INVALID_PERIOD", rows: [], total: 0 })} />);
    const from = screen.getByLabelText("De");
    expect(from.getAttribute("aria-invalid")).toBe("true");
    const hint = document.getElementById(from.getAttribute("aria-describedby")!)!;
    expect(hint.textContent).toBe("Escolha um período de até 31 dias, com o início antes do fim.");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("link", { name: "Baixar planilha" })).toBeNull();
  });

  it("nada no período", () => {
    render(<AuditReportPage {...props({ rows: [], total: 0 })} />);
    expect(screen.getByText("Nenhum registro com esse filtro.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("página de 50 em 50 mantendo o filtro", () => {
    const many = props({
      query: { de: "2026-11-20", ate: "2026-11-20", pessoa: "", tipo: "ORDERS", negadas: false },
      total: 120,
      page: 2,
    });
    render(<AuditReportPage {...many} />);
    const nav = screen.getByRole("navigation", { name: "Páginas" });
    expect(nav.textContent).toContain("Página 2 de 3");
    expect(within(nav).getByRole("link", { name: "← Anterior" }).getAttribute("href")).toBe(
      "/equipe/auditoria?de=2026-11-20&ate=2026-11-20&tipo=ORDERS&pagina=1",
    );
    expect(within(nav).getByRole("link", { name: "Próxima →" }).getAttribute("href")).toBe(
      "/equipe/auditoria?de=2026-11-20&ate=2026-11-20&tipo=ORDERS&pagina=3",
    );
    cleanup();
    render(<AuditReportPage {...many} page={1} />);
    expect(screen.queryByRole("link", { name: "← Anterior" })).toBeNull();
    cleanup();
    render(<AuditReportPage {...many} page={3} />);
    expect(screen.queryByRole("link", { name: "Próxima →" })).toBeNull();
    cleanup();
    render(<AuditReportPage {...many} total={50} page={1} />);
    expect(screen.queryByRole("navigation", { name: "Páginas" })).toBeNull();
  });
});

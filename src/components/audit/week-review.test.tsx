// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { WeekReview, type WeekReviewProps } from "./week-review";

afterEach(cleanup);

const exception = {
  requestId: "r1",
  decidedAt: new Date("2026-11-17T15:30:00Z"),
  decidedByName: "Gerente Gil",
  itemId: "i1",
  itemName: "Tomate",
  difference: "-1.5",
  stockUnit: "kg" as const,
  value: "-4.50",
  reasonLabel: "Conferi na prateleira",
  notes: "faltou na contagem",
  balance: "18.5",
};

const props = (over: Partial<WeekReviewProps["week"]> = {}): WeekReviewProps => ({
  timezone: "America/Sao_Paulo",
  action: async () => null,
  week: {
    weekStart: "2026-11-16",
    weekEnd: "2026-11-22",
    closed: true,
    review: null,
    total: "-4.50",
    exceptions: [exception],
    ...over,
  },
});

describe("revisão da semana (spec 019, US3-2 e US3-3)", () => {
  it("lista as exceções com quando, quem, item, quantidade, valor, motivo e saldo atual, e o total", () => {
    render(<WeekReview {...props()} />);
    expect(screen.getByRole("heading", { name: "Semana de 16/11 a 22/11" })).toBeTruthy();
    const table = screen.getByRole("table", { name: "Exceções da semana" });
    expect(
      within(table)
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual([
      "17/11/2026, 12:30:00",
      "Gerente Gil",
      "Tomate",
      "-1,5 kg",
      "R$ -4,50",
      "Conferi na prateleirafaltou na contagem",
      "18,5 kg",
    ]);
    expect(within(table).getByRole("link", { name: "Tomate" }).getAttribute("href")).toBe(
      "/estoque/itens/i1",
    );
    expect(screen.getByText("Total das exceções: R$ -4,50")).toBeTruthy();
    const form = screen.getByRole("form", { name: "Marcar a semana como revisada" });
    expect((within(form).getByLabelText("Observação (opcional)") as HTMLTextAreaElement).maxLength).toBe(140);
    expect(within(form).getByRole("button", { name: "Marcar como revisada" })).toBeTruthy();
    expect((form.querySelector("input[name=weekStart]") as HTMLInputElement).value).toBe("2026-11-16");
  });

  it("semana revisada mostra quem, quando e a observação, sem o botão", () => {
    render(
      <WeekReview
        {...props({
          review: { reviewedByName: "Ana", reviewedAt: new Date("2026-11-23T13:00:00Z"), note: "ok" },
        })}
      />,
    );
    expect(screen.getByText("Revisada por Ana em 23/11/2026, 10:00:00. Observação: ok")).toBeTruthy();
    expect(screen.queryByRole("form")).toBeNull();
    cleanup();
    render(
      <WeekReview
        {...props({
          review: { reviewedByName: null, reviewedAt: new Date("2026-11-23T13:00:00Z"), note: null },
        })}
      />,
    );
    expect(screen.getByText("Revisada por — em 23/11/2026, 10:00:00.")).toBeTruthy();
  });

  it("semana em andamento ainda não deixa marcar; semana sem exceção diz isso", () => {
    render(<WeekReview {...props({ closed: false })} />);
    expect(screen.getByText("A semana ainda não acabou. A revisão abre na segunda-feira.")).toBeTruthy();
    expect(screen.queryByRole("form")).toBeNull();
    cleanup();
    render(<WeekReview {...props({ exceptions: [], total: "0.00" })} />);
    expect(screen.getByText("Nenhuma exceção nesta semana.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("form")).toBeNull();
  });
});

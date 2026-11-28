import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

/**
 * Spec 019 (US1 e US2, SC-002): o gerente único liga a operação pequena, pede e aprova o próprio
 * acerto, o saldo muda e a exceção aparece nos Lançamentos e na Auditoria.
 */
test("gerente único aprova o próprio acerto como exceção e acha na Auditoria", async ({ page }) => {
  await signUp(page, "Lanchonete E2E");
  await page.goto("/estoque/itens/novo");
  await page.getByLabel("Nome do item").fill("Feijão");
  await page.getByLabel("Grupo", { exact: true }).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Cadastrar item" }).click();
  await page.getByText(/Item cadastrado com o código/).waitFor();
  await page.goto("/estoque/lancamentos");
  const form = page.getByRole("form", { name: "Lançamento", exact: true });
  await form.getByLabel("Item").selectOption({ label: "Feijão (kg)" });
  await form.getByLabel("Quantidade").fill("10");
  await form.getByLabel("Valor total pago (R$)").fill("80");
  await form.getByRole("button", { name: "Lançar" }).click();
  await expect(form.getByText("Lançamento registrado.")).toBeVisible();

  // Sem o modo: o próprio pedido fica esperando outro gerente.
  await form.getByLabel("Tipo de lançamento").selectOption("ADJUSTMENT");
  await form.getByLabel("Item").selectOption({ label: "Feijão (kg)" });
  await form.getByLabel("Quanto tem de verdade").fill("9");
  await form.getByLabel("Motivo", { exact: true }).selectOption({ label: "Conferi na prateleira" });
  await form.getByRole("button", { name: "Pedir acerto" }).click();
  await expect(form.getByText("Pedido de acerto enviado para aprovação.")).toBeVisible();
  const pending = page.getByRole("region", { name: "Acertos esperando aprovação" });
  await expect(pending.getByText("Outro gerente precisa aprovar.")).toBeVisible();
  await expect(pending.getByRole("button", { name: "Aprovar" })).toHaveCount(0);

  // Liga o modo (Equipe › Operação pequena), com confirmação.
  await page.goto("/equipe");
  await page
    .getByRole("navigation", { name: "Controles da equipe" })
    .getByRole("link", { name: "Operação pequena" })
    .click();
  await expect(page.getByText("Desligado", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ligar o modo" }).click();
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText("Ligado", { exact: true })).toBeVisible();

  await page.goto("/estoque/lancamentos");
  await expect(
    pending.getByText("Operação pequena: se você aprovar, fica marcado como exceção."),
  ).toBeVisible();
  await pending.getByRole("button", { name: "Aprovar" }).click();
  await expect(pending.getByText("Nenhum acerto esperando.")).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Últimos lançamentos" })
      .getByText("Aprovado por quem pediu (operação pequena)"),
  ).toBeVisible();
  await page.goto("/estoque/itens");
  await expect(page.getByRole("cell", { name: "9 kg" })).toBeVisible();

  // Auditoria: tipo Lançamentos de estoque mostra a aprovação como exceção.
  await page
    .getByRole("navigation", { name: "Menu principal" })
    .getByRole("link", { name: "Auditoria" })
    .click();
  const filters = page.getByRole("search");
  await filters.getByLabel("Tipo de operação").selectOption({ label: "Lançamentos de estoque" });
  await filters.getByRole("button", { name: "Filtrar" }).click();
  const table = page.getByRole("table", { name: "Registros da auditoria" });
  await expect(table.getByText("Aprovado por quem pediu (operação pequena): não → sim")).toBeVisible();
  await expect(page).toHaveURL(/tipo=STOCK/);
});

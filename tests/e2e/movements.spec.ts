import { expect, test } from "@playwright/test";
import { lastMailTo, PASSWORD, signUp, uniqueEmail } from "./helpers";

test("compra 3 caixas de tomate, perde 500 g, estorna a perda e vê o saldo (spec 004)", async ({ page }) => {
  await signUp(page, "Mercearia E2E");
  await page.goto("/estoque/itens/novo");
  await page.getByLabel("Nome do item").fill("Tomate");
  await page.getByLabel("Grupo", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Medida").selectOption("kg");
  await page.getByLabel("Embalagem", { exact: true }).fill("Caixa");
  await page.getByLabel("Quanto vem em cada embalagem").fill("20");
  await page.getByRole("button", { name: "Cadastrar item" }).click();
  await page.getByText(/Item cadastrado com o código/).waitFor();

  await page
    .getByRole("navigation", { name: "Menu principal" })
    .getByRole("link", { name: "Lançamentos" })
    .click();
  const form = page.getByRole("form", { name: "Lançamento", exact: true });
  await form.getByLabel("Item").selectOption({ label: "Tomate (kg)" });
  await form.getByLabel("Medida").selectOption("PACKAGE");
  await form.getByLabel("Quantidade").fill("3");
  await form.getByLabel("Valor total pago (R$)").fill("240,00");
  await expect(form.getByTestId("movement-preview")).toHaveText("Vai entrar: 60 kg");
  await expect(form.getByTestId("movement-unit-cost")).toHaveText("R$ 4,00 por kg");
  await form.getByRole("button", { name: "Lançar" }).click();
  await expect(form.getByText("Lançamento registrado.")).toBeVisible();

  await form.getByLabel("Tipo de lançamento").selectOption("LOSS");
  await form.getByLabel("Item").selectOption({ label: "Tomate (kg)" });
  await expect(form.getByTestId("movement-balance")).toHaveText("Em estoque: 60 kg");
  await form.getByLabel("Quantidade").fill("500");
  await form.getByLabel("Medida").selectOption("g");
  await form.getByLabel("Motivo", { exact: true }).selectOption({ label: "Queimou" });
  await form.getByRole("button", { name: "Lançar" }).click();
  await expect(form.getByText("Lançamento registrado.")).toBeVisible();

  const table = page.getByRole("region", { name: "Últimos lançamentos" });
  await expect(table.getByRole("cell", { name: "-0,5 kg" })).toBeVisible();
  const lossRow = table.getByRole("row").filter({ hasText: "Queimou" });
  await lossRow.getByLabel("Motivo do estorno").selectOption({ label: "Lançado errado" });
  await lossRow.getByRole("button", { name: "Estornar" }).click();
  await expect(table.getByText("estornado")).toBeVisible();

  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Itens" }).click();
  await expect(page.getByRole("cell", { name: "60 kg" })).toBeVisible();
  await page.getByRole("link", { name: "Tomate" }).click();
  await expect(page.getByTestId("item-balance")).toContainText("60 kg");
  await expect(page.getByText("Custo médio")).toBeVisible();
});

test("chef pede acerto; o gerente aprova e o saldo muda (spec 004, US3)", async ({ page, browser }) => {
  await signUp(page, "Bistrô E2E");
  await page.goto("/estoque/itens/novo");
  await page.getByLabel("Nome do item").fill("Arroz");
  await page.getByLabel("Grupo", { exact: true }).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Cadastrar item" }).click();
  await page.getByText(/Item cadastrado com o código/).waitFor();
  await page.goto("/estoque/lancamentos");
  const form = page.getByRole("form", { name: "Lançamento", exact: true });
  await form.getByLabel("Item").selectOption({ label: "Arroz (kg)" });
  await form.getByLabel("Quantidade").fill("10");
  await form.getByLabel("Valor total pago (R$)").fill("50");
  await form.getByRole("button", { name: "Lançar" }).click();
  await expect(form.getByText("Lançamento registrado.")).toBeVisible();

  await page.goto("/equipe");
  const chefEmail = uniqueEmail("chef");
  const invite = page.getByRole("form", { name: "Convidar pessoa" });
  await invite.getByLabel("E-mail").fill(chefEmail);
  await invite.getByRole("button", { name: "Enviar convite" }).click();
  await expect(invite.getByText("Convite enviado.")).toBeVisible();
  const link = /https?:\/\/\S+\/convite\/\S+/.exec((await lastMailTo(chefEmail)).text)![0];

  const chefContext = await browser.newContext();
  const chef = await chefContext.newPage();
  await chef.goto(new URL(link).pathname);
  await chef.getByLabel("Seu nome").fill("Chef Ana");
  await chef.getByLabel("Senha").fill(PASSWORD);
  await chef.getByRole("button", { name: "Aceitar convite" }).click();
  await expect(chef).toHaveURL(/\/estoque\/itens/);
  await chef.goto("/estoque/lancamentos");
  const chefForm = chef.getByRole("form", { name: "Lançamento", exact: true });
  await chefForm.getByLabel("Tipo de lançamento").selectOption("ADJUSTMENT");
  await chefForm.getByLabel("Item").selectOption({ label: "Arroz (kg)" });
  await chefForm.getByLabel("Quanto tem de verdade").fill("8");
  await expect(chefForm.getByTestId("movement-preview")).toHaveText("Diferença: −2 kg (faltam)");
  await chefForm.getByLabel("Motivo", { exact: true }).selectOption({ label: "Conferi na prateleira" });
  await chefForm.getByRole("button", { name: "Pedir acerto" }).click();
  await expect(chefForm.getByText("Pedido de acerto enviado para aprovação.")).toBeVisible();
  await expect(chef.getByRole("button", { name: /Aprovar/ })).toHaveCount(0);
  await chefContext.close();

  await page.goto("/estoque/lancamentos");
  const pending = page.getByRole("region", { name: "Acertos esperando aprovação" });
  await expect(pending.getByRole("cell", { name: "Chef Ana" })).toBeVisible();
  await pending.getByRole("button", { name: "Aprovar" }).click();
  await expect(pending.getByText("Nenhum acerto esperando.")).toBeVisible();
  await page.goto("/estoque/itens");
  await expect(page.getByRole("cell", { name: "8 kg" })).toBeVisible();
});

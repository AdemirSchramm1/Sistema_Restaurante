import { expect, test } from "@playwright/test";
import { lastMailTo, PASSWORD, signUp, uniqueEmail } from "./helpers";

test("gerente convida chef; chef aceita, não gerencia grupos e cadastra item (US5)", async ({
  page,
  browser,
}) => {
  await signUp(page, "Cantina E2E");
  await page.getByRole("link", { name: "Equipe" }).click();
  const chefEmail = uniqueEmail("chef");
  const invite = page.getByRole("form", { name: "Convidar pessoa" });
  await invite.getByLabel("E-mail").fill(chefEmail);
  await invite.getByRole("button", { name: "Enviar convite" }).click();
  await expect(invite.getByText("Convite enviado.")).toBeVisible();
  await expect(page.getByText(chefEmail)).toBeVisible();

  const mail = await lastMailTo(chefEmail);
  expect(mail.text).toContain("Cantina E2E");
  const link = /https?:\/\/\S+\/convite\/\S+/.exec(mail.text)?.[0];
  expect(link).toBeTruthy();

  const chefContext = await browser.newContext();
  const chef = await chefContext.newPage();
  await chef.goto(new URL(link!).pathname);
  await expect(chef.getByRole("heading", { name: "Entrar na equipe do Cantina E2E" })).toBeVisible();
  await chef.getByLabel("Seu nome").fill("Chef Ana");
  await chef.getByLabel("Senha").fill(PASSWORD);
  await chef.getByRole("button", { name: "Aceitar convite" }).click();
  await expect(chef).toHaveURL(/\/estoque\/itens/);

  await chef.getByRole("link", { name: "Grupos" }).click();
  await expect(chef.getByRole("heading", { name: "Grupos e subgrupos" })).toBeVisible();
  await expect(chef.getByRole("button", { name: "Criar grupo" })).toHaveCount(0);
  await expect(chef.getByRole("button", { name: "Renomear" })).toHaveCount(0);

  await chef.getByRole("link", { name: "Itens" }).click();
  await chef.getByRole("link", { name: "Novo item" }).click();
  await chef.getByLabel("Nome do item").fill("Ovo branco");
  await chef
    .getByLabel("Grupo", { exact: true })
    .selectOption({ label: "04.04 · Laticínios, frios e ovos › Ovos" });
  await chef.getByLabel("Medida").selectOption("un");
  await chef.getByLabel("Embalagem", { exact: true }).fill("Caixa");
  await chef.getByLabel("Quanto vem em cada embalagem").fill("360");
  await chef.getByRole("button", { name: "Cadastrar item" }).click();
  await expect(chef.getByText(/Item cadastrado com o código 04\.04\.0001/)).toBeVisible();
  await chefContext.close();
});

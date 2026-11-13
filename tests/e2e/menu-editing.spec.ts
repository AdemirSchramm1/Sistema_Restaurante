import { expect, test, type Page } from "@playwright/test";
import { login, seedMenu } from "../support/seed";

/** Roteiro do quickstart da spec 013: gerente e chef editam o cardápio. */
const sectionTitles = (page: Page) =>
  page.locator("main").getByRole("heading", { level: 2 }).allTextContents();

test("chef organiza o cardápio em seções; estoquista não entra (spec 013, US2)", async ({
  page,
  browser,
}) => {
  const s = seedMenu("plain");
  await login(page, s.chef, s.password);
  await page.getByRole("link", { name: "Cardápio", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Cardápio" })).toBeVisible();
  expect(await sectionTitles(page)).toEqual(["Outros"]);

  const create = page.getByRole("form", { name: "Nova seção" });
  for (const name of ["Entradas", "Lanches", "Bebidas"]) {
    await create.getByLabel("Nome da seção nova").fill(name);
    await create.getByRole("button", { name: "Criar seção" }).click();
    await expect(page.getByRole("region", { name })).toBeVisible();
  }
  expect(await sectionTitles(page)).toEqual(["Entradas", "Lanches", "Bebidas", "Outros"]);

  await create.getByLabel("Nome da seção nova").fill("lanches");
  await create.getByRole("button", { name: "Criar seção" }).click();
  await expect(create.getByRole("alert")).toHaveText("Já existe a seção Lanches.");
  await expect(create.getByLabel("Nome da seção nova")).toHaveValue("lanches");

  const entradas = page.getByRole("region", { name: "Entradas" });
  await entradas.getByText("Renomear ou apagar").click();
  await entradas.getByLabel("Nome da seção Entradas").fill("Petiscos");
  await entradas.getByRole("button", { name: "Salvar nome" }).click();
  await expect(page.getByRole("region", { name: "Petiscos" })).toBeVisible();

  await page.getByRole("button", { name: "Subir Bebidas" }).click();
  await expect.poll(() => sectionTitles(page)).toEqual(["Petiscos", "Bebidas", "Lanches", "Outros"]);
  await expect(page.getByRole("button", { name: "Subir Petiscos" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Descer Lanches" })).toBeDisabled();

  // O quadro "Renomear ou apagar" continua aberto depois de salvar o nome.
  const petiscos = page.getByRole("region", { name: "Petiscos" });
  await petiscos.getByRole("button", { name: "Apagar Petiscos" }).click();
  await expect(petiscos.getByText("Petiscos não tem produtos")).toBeVisible();
  await petiscos.getByRole("button", { name: "Apagar seção" }).click();
  await expect.poll(() => sectionTitles(page)).toEqual(["Bebidas", "Lanches", "Outros"]);

  const other = await browser.newContext();
  const stock = await other.newPage();
  await login(stock, s.stockkeeper, s.password);
  await expect(stock.getByRole("link", { name: "Cardápio", exact: true })).toHaveCount(0);
  await stock.goto("/pedidos/cardapio");
  await expect(stock.getByRole("heading", { name: "Sem acesso" })).toBeVisible();
  await other.close();
});

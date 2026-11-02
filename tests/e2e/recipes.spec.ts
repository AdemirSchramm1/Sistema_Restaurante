import { expect, test, type Page } from "@playwright/test";
import { signUp } from "./helpers";

async function newItem(page: Page, name: string, unit: "kg" | "un") {
  await page.goto("/estoque/itens/novo");
  await page.getByLabel("Nome do item").fill(name);
  await page.getByLabel("Grupo", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Medida").selectOption(unit);
  await page.getByRole("button", { name: "Cadastrar item" }).click();
  await page.getByText(/Item cadastrado com o código/).waitFor();
}

async function line(page: Page, n: number, component: string, quantity: string, unit: string) {
  if (n > 1) await page.getByRole("button", { name: "Adicionar item ou preparo" }).click();
  await page.getByLabel(`Item ou preparo da linha ${n}`).selectOption({ label: component });
  await page.getByLabel(`Quanto vai (linha ${n})`).fill(quantity);
  await page.getByLabel(`Medida (linha ${n})`).selectOption(unit);
}

test("cadastra o molho e o X-Burger que usa o molho; editar cria a versão 2 (spec 003)", async ({ page }) => {
  await signUp(page, "Lanchonete E2E");
  await newItem(page, "Pão de hambúrguer", "un");
  await newItem(page, "Carne moída", "kg");
  await newItem(page, "Tomate", "kg");

  const menu = page.getByRole("navigation", { name: "Menu principal" });
  await menu.getByRole("link", { name: "Produtos" }).click();
  await page.getByRole("link", { name: "Novo produto" }).click();
  await page.getByLabel("Nome do produto").fill("Molho de tomate");
  await page.getByLabel("Tipo").selectOption("SUB_RECIPE");
  await page.getByLabel("Quanto rende").fill("2");
  await page.getByLabel("Medida do rendimento").selectOption("kg");
  await line(page, 1, "Tomate (kg)", "2,5", "kg");
  await page.getByRole("button", { name: "Cadastrar produto" }).click();
  await expect(page.getByText("Produto cadastrado.")).toBeVisible();

  await page.goto("/estoque/produtos/novo");
  await page.getByLabel("Nome do produto").fill("X-Burger");
  await line(page, 1, "Pão de hambúrguer (un)", "1", "un");
  await line(page, 2, "Carne moída (kg)", "150", "g");
  await line(page, 3, "Molho de tomate (rende em kg)", "50", "g");
  await page.getByRole("button", { name: "Cadastrar produto" }).click();
  await expect(page.getByText("Produto cadastrado.")).toBeVisible();
  await expect(page.getByText(/versão 1 desde/)).toBeVisible();
  await expect(page.getByTestId("recipe-total")).toContainText("Sem custo ainda");

  await page.getByLabel("Quanto vai (linha 2)").fill("180");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText(/versão 2 desde/)).toBeVisible();
  await expect(page.getByText("O que vai nele: ", { exact: false })).toBeVisible();

  await menu.getByRole("link", { name: "Produtos" }).click();
  await expect(page.getByRole("link", { name: "X-Burger" })).toBeVisible();
  await page.getByRole("link", { name: "Molho de tomate" }).click();
  await expect(page.getByText("Usado em:")).toContainText("X-Burger");
  await page.getByRole("button", { name: "Inativar" }).click();
  await expect(page.getByText(/Este preparo está em uso em: X-Burger/)).toBeVisible();
});

test("erro numa linha não apaga o que foi digitado", async ({ page }) => {
  await signUp(page, "Restaurante Linhas");
  await newItem(page, "Queijo prato", "kg");
  await page.goto("/estoque/produtos/novo");
  await page.getByLabel("Nome do produto").fill("Misto quente");
  await line(page, 1, "Queijo prato (kg)", "0", "g");
  await page.getByRole("button", { name: "Cadastrar produto" }).click();
  await expect(page.getByLabel("Quanto vai (linha 1)")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Nome do produto")).toHaveValue("Misto quente");
});

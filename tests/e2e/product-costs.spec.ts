import { expect, test, type Page } from "@playwright/test";
import { signUp } from "./helpers";

async function newItem(page: Page, name: string, unit: "kg" | "un") {
  await page.goto("/estoque/itens/novo");
  await page.getByLabel("Nome do item").fill(name);
  await page.getByLabel("Grupo", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Medida").selectOption(unit);
  await page.getByRole("button", { name: "Cadastrar item" }).click();
  await page.getByText(/Item cadastrado com o código/).waitFor();
  return page.url();
}

async function buy(page: Page, item: string, unit: "kg" | "un", quantity: string, total: string) {
  await page.goto("/estoque/lancamentos");
  const form = page.getByRole("form", { name: "Lançamento", exact: true });
  await form.getByLabel("Item").selectOption({ label: `${item} (${unit})` });
  await form.getByLabel("Medida").selectOption(unit);
  await form.getByLabel("Quantidade").fill(quantity);
  await form.getByLabel("Valor total pago (R$)").fill(total);
  await form.getByRole("button", { name: "Lançar" }).click();
  await expect(form.getByText("Lançamento registrado.")).toBeVisible();
}

async function line(page: Page, n: number, component: string, quantity: string, unit: string) {
  if (n > 1) await page.getByRole("button", { name: "Adicionar item ou preparo" }).click();
  await page.getByLabel(`Item ou preparo da linha ${n}`).selectOption({ label: component });
  await page.getByLabel(`Quanto vai (linha ${n})`).fill(quantity);
  await page.getByLabel(`Medida (linha ${n})`).selectOption(unit);
}

test("compra os itens, cadastra o X-Burger, define o preço e vê no painel e no item (spec 008)", async ({
  page,
}) => {
  await signUp(page, "Hamburgueria E2E");
  await newItem(page, "Pão de hambúrguer", "un");
  const carneUrl = await newItem(page, "Carne moída", "kg");
  await newItem(page, "Queijo prato", "kg");
  // Pão R$ 1,00/un, carne R$ 40,00/kg, queijo R$ 50,00/kg.
  await buy(page, "Pão de hambúrguer", "un", "10", "10,00");
  await buy(page, "Carne moída", "kg", "2", "80,00");
  await buy(page, "Queijo prato", "kg", "1", "50,00");

  await page.goto("/estoque/produtos/novo");
  await page.getByLabel("Nome do produto").fill("X-Burger");
  await line(page, 1, "Pão de hambúrguer (un)", "1", "un");
  await line(page, 2, "Carne moída (kg)", "150", "g");
  await line(page, 3, "Queijo prato (kg)", "30", "g");
  await page.getByRole("button", { name: "Cadastrar produto" }).click();
  await expect(page.getByText("Produto cadastrado.")).toBeVisible();

  // Preço de venda: R$ 28,00 → R$ 8,50 de custo = 30,4%.
  await page.getByLabel("Vendo por (R$)").fill("28,00");
  await page.getByRole("button", { name: "Salvar preço" }).click();
  await expect(page.getByText("Preço salvo.")).toBeVisible();
  await expect(page.getByText(/30,4% do preço vai em ingredientes/)).toBeVisible();
  await expect(page.getByText(/Sobra R\$ 19,50 por venda/)).toBeVisible();

  // Painel.
  const menu = page.getByRole("navigation", { name: "Menu principal" });
  await menu.getByRole("link", { name: "Custos" }).click();
  await expect(page.getByRole("heading", { name: "Custo dos produtos" })).toBeVisible();
  const row = page
    .getByRole("table", { name: "Custo dos produtos" })
    .getByRole("row")
    .filter({ hasText: "X-Burger" });
  await expect(row).toContainText("R$ 8,50");
  await expect(row).toContainText("R$ 28,00");
  await expect(row).toContainText("30,4%");
  await expect(row).toContainText("dentro da faixa");
  await expect(row).toContainText("Carne moída");
  await expect(page.getByRole("list", { name: "Resumo" })).toContainText("1 produto dentro da faixa");

  // No item: em quais produtos ele entra.
  await page.goto(carneUrl);
  const usage = page.getByRole("list", { name: "Usado nos produtos" });
  await expect(usage).toContainText("X-Burger");
  await expect(usage).toContainText("30,4% do preço");
});

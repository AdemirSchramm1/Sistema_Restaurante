import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("cadastra fornecedor com CNPJ, diz que vende tomate em caixa de 18 kg, compra 2 caixas dele e compara no item (spec 007)", async ({
  page,
}) => {
  await signUp(page, "Cantina E2E");
  await page.goto("/estoque/itens/novo");
  await page.getByLabel("Nome do item").fill("Tomate");
  await page.getByLabel("Grupo", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Medida").selectOption("kg");
  await page.getByRole("button", { name: "Cadastrar item" }).click();
  await page.getByText(/Item cadastrado com o código/).waitFor();

  const nav = page.getByRole("navigation", { name: "Menu principal" });
  await nav.getByRole("link", { name: "Fornecedores" }).click();
  await page.getByRole("link", { name: "Novo fornecedor" }).click();
  const form = page.getByRole("form", { name: "Cadastro do fornecedor" });
  await form.getByLabel("Nome do fornecedor").fill("Hortifruti do João");
  await form.getByLabel("CNPJ (opcional)").fill("11.222.333/0001-80");
  await form.getByLabel("segunda").check();
  await form.getByLabel("sexta").check();
  await form.getByRole("button", { name: "Cadastrar fornecedor" }).click();
  await expect(form.getByText(/CNPJ inválido/).first()).toBeVisible();
  await expect(form.getByLabel("Nome do fornecedor")).toHaveValue("Hortifruti do João");
  await form.getByLabel("CNPJ (opcional)").fill("11.222.333/0001-81");
  await form.getByRole("button", { name: "Cadastrar fornecedor" }).click();
  await expect(page.getByText(/Fornecedor cadastrado/)).toBeVisible();
  await expect(page.getByText("11.222.333/0001-81", { exact: true })).toBeVisible();

  const add = page.getByRole("form", { name: "Adicionar item ao fornecedor" });
  await add.getByLabel("Item").selectOption({ label: "Tomate (kg)" });
  await add.getByLabel("Preço (R$)").fill("90,00");
  await add.getByLabel("Embalagem (opcional)").fill("Caixa");
  await add.getByLabel("Quanto vem (kg)").fill("18");
  await expect(add.getByTestId("supplier-item-unit-price")).toHaveText("= R$ 5,00/kg");
  await add.getByLabel("Marcar como preferido").check();
  await add.getByRole("button", { name: "Adicionar" }).click();
  const items = page.getByRole("table", { name: "Itens que vende" });
  await expect(items.getByRole("row").filter({ hasText: "Tomate" })).toContainText("R$ 5,00/kg");

  await nav.getByRole("link", { name: "Lançamentos" }).click();
  const launch = page.getByRole("form", { name: "Lançamento", exact: true });
  await launch.getByLabel("Item").selectOption({ label: "Tomate (kg)" });
  await launch.getByLabel("Fornecedor (opcional)").selectOption({ label: "Hortifruti do João" });
  await launch.getByLabel("Medida").selectOption("SUPPLIER_PACKAGE");
  await launch.getByLabel("Quantidade").fill("2");
  await expect(launch.getByTestId("movement-preview")).toHaveText("Vai entrar: 36 kg");
  await launch.getByLabel("Valor total pago (R$)").fill("176,40");
  await launch.getByRole("button", { name: "Lançar" }).click();
  await expect(launch.getByText("Lançamento registrado.")).toBeVisible();
  const recent = page.getByRole("region", { name: "Últimos lançamentos" });
  await expect(recent.getByText("De Hortifruti do João")).toBeVisible();

  await nav.getByRole("link", { name: "Itens" }).click();
  await page.getByRole("link", { name: "Tomate" }).click();
  const offers = page.getByRole("table", { name: "Fornecedores do item" });
  const row = offers.getByRole("row").filter({ hasText: "Hortifruti do João" });
  await expect(row).toContainText("Preferido");
  await expect(row.getByTestId("offer-unit-price")).toHaveText("R$ 5,00/kg");
  await expect(row).toContainText("R$ 4,90/kg");
  await expect(page.getByTestId("item-balance")).toContainText("36 kg");
});

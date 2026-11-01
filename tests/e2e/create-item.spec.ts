import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("gerente cria a conta, aceita os locais sugeridos e cadastra o tomate (spec 002, US1)", async ({
  page,
}) => {
  await signUp(page);

  await expect(page.getByRole("heading", { name: "Comece pelos locais sugeridos" })).toBeVisible();
  await page.getByRole("button", { name: "Criar locais marcados" }).click();
  await expect(page.getByRole("heading", { name: "Geladeira", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Itens" }).click();
  await page.getByRole("link", { name: "Novo item" }).click();
  await page.getByLabel("Nome do item").fill("Tomate italiano");
  await page
    .getByLabel("Grupo", { exact: true })
    .selectOption({ label: "01.02 · Hortifrúti (FLV) › Legumes" });
  await page.getByLabel("Medida").selectOption("kg");
  await page.getByLabel("Embalagem", { exact: true }).fill("Caixa");
  await page.getByLabel("Quanto vem em cada embalagem").fill("20");
  await expect(page.getByTestId("purchase-summary")).toHaveText("1 Caixa = 20 kg");
  await page.getByRole("button", { name: "Cadastrar item" }).click();

  await expect(page.getByText("Item cadastrado com o código 01.02.0001.")).toBeVisible();
  await expect(page.getByLabel("Código do item")).toHaveText("01.02.0001");

  // Diz onde o item fica guardado.
  const locais = page.getByRole("form", { name: "Locais do item" });
  await locais.getByRole("checkbox", { name: /^Geladeira/ }).check();
  await locais.getByRole("radio", { name: "Local principal: Geladeira" }).check();
  await locais.getByRole("button", { name: "Salvar locais" }).click();
  await expect(locais.getByText("Locais salvos.")).toBeVisible();

  await page.getByRole("link", { name: "Itens" }).click();
  await page.getByLabel("Buscar").fill("tomate");
  await page.getByLabel("Buscar").press("Enter");
  await expect(page.getByRole("cell", { name: "01.02.0001" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "1 Caixa = 20 kg" })).toBeVisible();
});

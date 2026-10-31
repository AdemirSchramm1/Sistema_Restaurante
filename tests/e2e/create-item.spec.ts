import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("gerente cria a conta, aceita os locais sugeridos e cadastra o tomate (US1, cenário 1.1)", async ({
  page,
}) => {
  await signUp(page);

  await expect(page.getByRole("heading", { name: "Comece pelos locais sugeridos" })).toBeVisible();
  await page.getByRole("button", { name: "Criar locais marcados" }).click();
  await expect(page.getByRole("heading", { name: "Câmara de carnes" })).toBeVisible();

  await page.getByRole("link", { name: "Itens" }).click();
  await page.getByRole("link", { name: "Novo item" }).click();
  await page.getByLabel("Descrição").fill("Tomate italiano, caixa 20 kg, tipo AA");
  await page.getByLabel("Grupo e subgrupo").selectOption({ label: "01.02 · Hortifrúti (FLV) › Legumes" });
  await page.getByLabel("Unidade de estoque (contagem)").selectOption("kg");
  await page.getByLabel("Unidade de receita (ficha técnica)").selectOption("g");
  await page.getByLabel("Unidade de compra (embalagem)").fill("Caixa 20 kg");
  await page.getByLabel(/Fator: quantos kg cabem/).fill("20");
  await expect(page.getByTestId("equivalence")).toContainText("20.000 g");
  await page.getByRole("button", { name: "Cadastrar item" }).click();

  await expect(page.getByText("Item cadastrado com o código 01.02.0001.")).toBeVisible();
  await expect(page.getByLabel("Código do item")).toHaveText("01.02.0001");

  // Liga o item à geladeira de hortifrúti como local padrão e confere a folha de contagem.
  const locais = page.getByRole("form", { name: "Locais do item" });
  await locais.getByRole("checkbox", { name: /Geladeira de hortifrúti/ }).check();
  await locais.getByRole("textbox", { name: /Posição na folha em Geladeira de hortifrúti/ }).fill("3");
  await locais.getByRole("radio", { name: /Local padrão: Geladeira de hortifrúti/ }).check();
  await locais.getByRole("button", { name: "Salvar locais" }).click();
  await expect(locais.getByText("Locais salvos.")).toBeVisible();

  await page.getByRole("link", { name: "Locais" }).click();
  await page
    .getByRole("region", { name: /Local Geladeira de hortifrúti/ })
    .or(page.getByLabel(/Local Geladeira de hortifrúti/))
    .getByRole("link", { name: "Folha de contagem" })
    .click();
  const sheet = page.getByRole("table", { name: "Itens da folha de contagem" });
  await expect(sheet.getByRole("row", { name: /3 01\.02\.0001 Tomate italiano/ })).toBeVisible();

  await page.getByRole("link", { name: "Itens" }).click();
  await page.getByLabel("Buscar").fill("tomate");
  await page.getByLabel("Buscar").press("Enter");
  await expect(page.getByRole("cell", { name: "01.02.0001" })).toBeVisible();
});

import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("gerente cria a conta e cadastra o tomate; não há mais tela de locais (spec 002, US1 e US3)", async ({
  page,
}) => {
  await signUp(page);

  const menu = page.getByRole("navigation", { name: "Menu principal" });
  await expect(menu.getByRole("link", { name: "Itens" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Locais" })).toHaveCount(0);

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

  await expect(page.getByText("Onde fica guardado")).toHaveCount(0);

  // O item agora tem "Voltar para os itens" no topo: o clique é no menu.
  await menu.getByRole("link", { name: "Itens" }).click();
  await page.getByLabel("Buscar").fill("tomate");
  await page.getByLabel("Buscar").press("Enter");
  await expect(page.getByRole("cell", { name: "01.02.0001" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "1 Caixa = 20 kg" })).toBeVisible();
});

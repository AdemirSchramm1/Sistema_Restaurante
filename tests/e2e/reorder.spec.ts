import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("define o aviso, perde tomate até o ponto, vê em Repor e nos gráficos (spec 006)", async ({ page }) => {
  await signUp(page, "Cantina E2E");
  await page.goto("/estoque/itens/novo");
  await page.getByLabel("Nome do item").fill("Tomate");
  await page.getByLabel("Grupo", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Medida").selectOption("kg");
  await page.getByLabel("Embalagem", { exact: true }).fill("Caixa");
  await page.getByLabel("Quanto vem em cada embalagem").fill("20");
  await page.getByRole("button", { name: "Cadastrar item" }).click();
  await page.getByText(/Item cadastrado com o código/).waitFor();
  const itemUrl = page.url();

  // Aviso: avisar em 20 kg, comprar até 50 kg.
  await page.getByLabel("Avisar quando chegar em (kg)").fill("20");
  await page.getByLabel("Comprar até (kg)").fill("50");
  await page.getByRole("button", { name: "Salvar aviso" }).click();
  await expect(page.getByText("Aviso salvo.")).toBeVisible();
  await expect(page.getByText("Chegou no ponto: comprar")).toBeVisible();

  // Compra 3 caixas (60 kg) e perde 45 kg: sobra 15 kg, abaixo do ponto.
  await page.goto("/estoque/lancamentos");
  const form = page.getByRole("form", { name: "Lançamento", exact: true });
  await form.getByLabel("Item").selectOption({ label: "Tomate (kg)" });
  await form.getByLabel("Medida").selectOption("PACKAGE");
  await form.getByLabel("Quantidade").fill("3");
  await form.getByLabel("Valor total pago (R$)").fill("240,00");
  await form.getByRole("button", { name: "Lançar" }).click();
  await expect(form.getByText("Lançamento registrado.")).toBeVisible();
  await form.getByLabel("Tipo de lançamento").selectOption("LOSS");
  await form.getByLabel("Item").selectOption({ label: "Tomate (kg)" });
  await form.getByLabel("Quantidade").fill("45");
  await form.getByLabel("Medida").selectOption("kg");
  await form.getByLabel("Motivo", { exact: true }).selectOption({ label: "Venceu" });
  await form.getByRole("button", { name: "Lançar" }).click();
  await expect(form.getByText("Lançamento registrado.")).toBeVisible();

  // Menu mostra 1 item para repor; a página diz quanto comprar.
  await page.reload();
  const menu = page.getByRole("navigation", { name: "Menu principal" });
  await expect(menu.getByLabel("1 item para repor")).toBeVisible();
  await menu.getByRole("link", { name: /Repor/ }).click();
  const row = page
    .getByRole("table", { name: "Itens para repor" })
    .getByRole("row")
    .filter({ hasText: "Tomate" });
  await expect(row).toContainText("15 kg");
  // 50 − (15 − 1,5) = 36,5 kg → 2 caixas de 20 kg (40 kg)
  await expect(row).toContainText("2 Caixas");
  await expect(row).toContainText("(40 kg)");

  // Item mostra a sugestão pelo consumo.
  await page.goto(itemUrl);
  await expect(page.getByText(/Sugestão do sistema/)).toBeVisible();

  // Gráficos: tomate é o que mais saiu e o motivo é "Venceu".
  await menu.getByRole("link", { name: "Gráficos" }).click();
  await expect(page.getByRole("heading", { name: "Gráficos do estoque" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Itens que mais saíram" })).toContainText("Tomate");
  await expect(page.getByRole("list", { name: "Itens que mais saíram" })).toContainText("R$ 180,00");
  await expect(page.getByRole("list", { name: "Saídas por motivo" })).toContainText("Venceu");
  await page.getByRole("link", { name: "7 dias" }).click();
  await expect(page.getByRole("link", { name: "7 dias" })).toHaveAttribute("aria-current", "page");
});

import AxeBuilder from "@axe-core/playwright";
import { devices, expect, test, type Page } from "@playwright/test";
import { signUp } from "./helpers";
import { createTables, customize, newAddon, newDish, newItem, openCash, qrPath } from "./ordering-helpers";
import { login, seedMenu } from "../support/seed";

/** Falhas graves de acessibilidade (WCAG 2.1 A e AA) numa página. */
async function seriousViolations(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return r.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id}: ${v.help} → ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(" | ")}`,
    );
}

test("páginas públicas sem falhas graves de acessibilidade", async ({ page }) => {
  for (const path of ["/entrar", "/criar-conta", "/recuperar-senha"]) {
    await page.goto(path);
    expect(await seriousViolations(page), path).toEqual([]);
  }
});

test("telas do estoque e da equipe sem falhas graves de acessibilidade", async ({ page }) => {
  await signUp(page, "Restaurante Acessível");
  expect(await seriousViolations(page), "/estoque/itens (primeiro acesso)").toEqual([]);

  await page.goto("/estoque/itens/novo");
  expect(await seriousViolations(page), "/estoque/itens/novo").toEqual([]);
  await page.getByLabel("Nome do item").fill("Arroz agulhinha");
  await page.getByLabel("Grupo", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Embalagem", { exact: true }).fill("Fardo");
  await page.getByLabel("Quanto vem em cada embalagem").fill("30");
  await page.getByRole("button", { name: "Cadastrar item" }).click();
  await page.getByText(/Item cadastrado com o código/).waitFor();
  expect(await seriousViolations(page), "detalhe do item").toEqual([]);

  await page.goto("/estoque/produtos/novo");
  expect(await seriousViolations(page), "/estoque/produtos/novo").toEqual([]);
  await page.getByLabel("Nome do produto").fill("Arroz pronto");
  await page.getByLabel("Item ou preparo da linha 1").selectOption({ index: 1 });
  await page.getByLabel("Quanto vai (linha 1)").fill("200");
  await page.getByRole("button", { name: "Cadastrar produto" }).click();
  await page.getByText("Produto cadastrado.").waitFor();
  expect(await seriousViolations(page), "detalhe do produto").toEqual([]);

  await page.goto("/estoque/fornecedores/novo");
  expect(await seriousViolations(page), "/estoque/fornecedores/novo").toEqual([]);
  await page.getByLabel("Nome do fornecedor").fill("Hortifruti Axe");
  await page.getByRole("button", { name: "Cadastrar fornecedor" }).click();
  await page.getByText(/Fornecedor cadastrado/).waitFor();
  expect(await seriousViolations(page), "detalhe do fornecedor").toEqual([]);

  for (const path of [
    "/estoque/itens",
    "/estoque/produtos",
    "/estoque/lancamentos",
    "/estoque/fornecedores",
    "/estoque/repor",
    "/estoque/graficos",
    "/estoque/custos",
    "/estoque/grupos",
    "/equipe",
  ]) {
    await page.goto(path);
    expect(await seriousViolations(page), path).toEqual([]);
  }
});

test("cardápio do celular, tela do prato, cozinha, garçom e telas de pedidos sem falhas graves (specs 009 e 010)", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  await signUp(page, `Pedidos Acessíveis ${Date.now()}`);
  await newItem(page, "Pão", "un");
  await newItem(page, "Queijo", "kg");
  await newItem(page, "Cebola", "kg");
  const burger = await newDish(
    page,
    "X-Burger",
    [
      { component: "Pão (un)", quantity: "1", unit: "un" },
      { component: "Queijo (kg)", quantity: "30", unit: "g" },
      { component: "Cebola (kg)", quantity: "20", unit: "g" },
    ],
    "28,00",
  );
  await page.goto("/pedidos/adicionais/novo");
  expect(await seriousViolations(page), "/pedidos/adicionais/novo").toEqual([]);
  const addon = await newAddon(page, {
    name: "Fatia de queijo",
    component: "Queijo",
    quantity: "20",
    unit: "g",
    price: "3,00",
  });
  expect(await seriousViolations(page), "detalhe do adicional").toEqual([]);
  await customize(page, burger, {
    addons: [{ label: "Fatia de queijo · R$ 3,00", name: "Fatia de queijo", maxTimes: 2 }],
    removals: ["Cebola"],
  });
  expect(await seriousViolations(page), "produto com o quadro adicionar e tirar").toEqual([]);
  await createTables(page, 1, 2);
  expect(await seriousViolations(page), "/pedidos/mesas").toEqual([]);
  const table = await qrPath(page, "1");

  const phoneContext = await browser.newContext({ ...devices["Pixel 7"], locale: "pt-BR" });
  const cell = await phoneContext.newPage();
  await cell.goto(table);
  await expect(cell.getByRole("heading", { name: "Mesa 1" })).toBeVisible();
  expect(await seriousViolations(cell), "cardápio").toEqual([]);
  await cell.getByRole("button", { name: "Pôr X-Burger no carrinho" }).click();
  expect(await seriousViolations(cell), "tela do prato").toEqual([]);
  await cell.getByRole("button", { name: "Mais Fatia de queijo" }).click();
  await cell.getByRole("button", { name: "Sem cebola" }).click();
  await cell.getByRole("button", { name: "Adicionar ao pedido" }).click();
  await cell.getByRole("button", { name: /^Ver pedido/ }).click();
  await cell.getByRole("button", { name: "Enviar pedido" }).click();
  expect(await seriousViolations(cell), "resumo do pedido").toEqual([]);
  await cell.getByRole("button", { name: "Confirmar" }).click();
  await expect(cell.getByText("Pedido enviado para a cozinha")).toBeVisible();
  expect(await seriousViolations(cell), "cardápio com pedido enviado").toEqual([]);
  await phoneContext.close();

  await page.goto("/pedidos/cozinha");
  await expect(page.getByRole("article", { name: "Pedido 1, Mesa 1" })).toBeVisible();
  expect(await seriousViolations(page), "/pedidos/cozinha").toEqual([]);
  await page.getByRole("button", { name: "Começar preparo" }).click();
  await page.getByRole("button", { name: "Pronto" }).click({ timeout: 10_000 });
  await expect(page.getByRole("region", { name: "Prontos" }).getByRole("article")).toHaveCount(1, {
    timeout: 10_000,
  });
  await page.goto("/pedidos/garcom");
  await expect(page.getByRole("article", { name: "Mesa 1, pedido 1" })).toBeVisible();
  expect(await seriousViolations(page), "/pedidos/garcom").toEqual([]);

  // Spec 015: Lançar pedido, a mesa com o carrinho e o resumo, e Pedidos da mesa.
  await page.goto("/pedidos/lancar");
  expect(await seriousViolations(page), "/pedidos/lancar").toEqual([]);
  await page.getByRole("link", { name: /Mesa 1\b/ }).click();
  await expect(page.getByRole("heading", { name: "Mesa 1", level: 1 })).toBeVisible();
  expect(await seriousViolations(page), "mesa no Lançar pedido").toEqual([]);
  await page.getByRole("button", { name: "Lista" }).click();
  await expect(page.getByRole("button", { name: "Lista" })).toHaveAttribute("aria-pressed", "true");
  // A troca de cor dos botões Fotos/Lista anima; o axe mede depois que ela termina.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
  expect(await seriousViolations(page), "mesa em Lista").toEqual([]);
  await page.getByRole("tab", { name: "Pedidos da mesa" }).click();
  await expect(page.getByRole("tab", { name: "Pedidos da mesa" })).toHaveAttribute("aria-selected", "true");
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
  expect(await seriousViolations(page), "Pedidos da mesa").toEqual([]);

  for (const path of ["/pedidos", "/pedidos/adicionais", addon]) {
    await page.goto(path);
    expect(await seriousViolations(page), path).toEqual([]);
  }
  await page.getByRole("link", { name: "Pedidos", exact: true }).click();
  await page.getByRole("link", { name: "1", exact: true }).click();
  await expect(page.getByText("SEM cebola")).toBeVisible();
  expect(await seriousViolations(page), "detalhe do pedido").toEqual([]);
});

test("caixa, conta da mesa, conta impressa, contas fechadas e cancelar depois do preparo sem falhas graves (spec 011)", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  await signUp(page, `Caixa Acessível ${Date.now()}`);
  await newItem(page, "Laranja", "kg");
  await newDish(page, "Suco", [{ component: "Laranja (kg)", quantity: "300", unit: "g" }], "9,00");
  await createTables(page, 1, 1);
  const table = await qrPath(page, "1");

  await page.goto("/caixa");
  await expect(page.getByText("Nenhuma mesa com conta aberta.")).toBeVisible();
  await page.getByText("Taxa de serviço do restaurante").click();
  await expect(page.getByLabel("Taxa de serviço (%)")).toBeVisible();
  expect(await seriousViolations(page), "/caixa sem contas, com a taxa do restaurante").toEqual([]);
  await openCash(page, "150,00");

  // Dois sucos do celular: o primeiro é entregue; o segundo, cancelado depois do preparo.
  const phoneContext = await browser.newContext({ ...devices["Pixel 7"], locale: "pt-BR" });
  const cell = await phoneContext.newPage();
  await cell.goto(table);
  for (const n of [1, 2]) {
    await cell.getByRole("button", { name: "Pôr Suco no carrinho" }).click();
    await cell.getByRole("button", { name: /^Ver pedido/ }).click();
    await cell.getByRole("button", { name: "Enviar pedido" }).click();
    await cell
      .getByRole("dialog", { name: "Confira o pedido" })
      .getByRole("button", { name: "Confirmar" })
      .click();
    await expect(cell.getByRole("status").filter({ hasText: "Pedido enviado para a cozinha" })).toContainText(
      `Pedido nº ${n}`,
    );
  }
  await phoneContext.close();

  await page.goto("/pedidos/cozinha");
  const preparing = page.getByRole("region", { name: "Em preparo" });
  for (const n of [1, 2]) {
    await page
      .getByRole("article", { name: `Pedido ${n}, Mesa 1` })
      .getByRole("button", { name: "Começar preparo" })
      .click();
    await expect(preparing.getByRole("article", { name: `Pedido ${n}, Mesa 1` })).toBeVisible({
      timeout: 10_000,
    });
  }
  const second = preparing.getByRole("article", { name: "Pedido 2, Mesa 1" });
  await second.getByRole("button", { name: "Cancelar pedido 2" }).click();
  await expect(second.getByRole("group", { name: "Os ingredientes já foram usados?" })).toBeVisible();
  expect(await seriousViolations(page), "cozinha: cancelar depois do preparo").toEqual([]);
  await second.getByLabel("Motivo").selectOption({ label: "Cliente desistiu" });
  await second.getByRole("button", { name: "Confirmar cancelamento" }).click();
  await expect(second).toHaveCount(0, { timeout: 10_000 });
  await preparing
    .getByRole("article", { name: "Pedido 1, Mesa 1" })
    .getByRole("button", { name: "Pronto" })
    .click();
  await expect(
    page.getByRole("region", { name: "Prontos" }).getByRole("article", { name: "Pedido 1, Mesa 1" }),
  ).toBeVisible({
    timeout: 10_000,
  });
  await page.goto("/pedidos/garcom");
  await page
    .getByRole("article", { name: "Mesa 1, pedido 1" })
    .getByRole("button", { name: "Entregue" })
    .click();
  await expect(page.getByText("Nenhum pedido pronto para levar.")).toBeVisible();

  await page.goto("/caixa");
  const card = page.getByRole("link", { name: /Mesa 1/ });
  await expect(card).toContainText("R$ 9,90");
  expect(await seriousViolations(page), "/caixa com conta aberta").toEqual([]);

  await card.click();
  await expect(page.getByRole("heading", { name: "Mesa 1 · conta aberta" })).toBeVisible();
  const tabUrl = new URL(page.url()).pathname;
  expect(await seriousViolations(page), "conta aberta").toEqual([]);
  await page.getByText("Dividir a conta").click();
  await page.getByLabel("Dividir por quantas pessoas?").fill("2");
  await expect(page.getByText("Parte 1 de 2: R$ 4,95")).toBeVisible();
  await page.getByRole("button", { name: "Tirar taxa de serviço" }).click();
  await expect(page.getByRole("button", { name: "Sim, tirar a taxa" })).toBeVisible();
  expect(await seriousViolations(page), "conta aberta: dividir e confirmar tirar a taxa").toEqual([]);
  await page.getByRole("button", { name: "Voltar", exact: true }).click();

  const pay = page.getByRole("form", { name: "Lançar pagamento" });
  await pay.getByRole("radio", { name: "Dinheiro" }).check();
  await pay.getByLabel("Recebido em dinheiro (R$)").fill("20,00");
  await expect(pay.getByText("Troco: R$ 10,10")).toBeVisible();
  expect(await seriousViolations(page), "pagamento em dinheiro com troco").toEqual([]);
  await pay.getByRole("button", { name: "Lançar pagamento" }).click();
  await expect(page.getByRole("region", { name: "Total da conta" }).getByRole("row").last()).toHaveText(
    "FaltaR$ 0,00",
  );
  await page.getByRole("button", { name: "Tirar pagamento de R$ 9,90 (Dinheiro)" }).click();
  await expect(page.getByRole("button", { name: "Sim, tirar" })).toBeVisible();
  expect(await seriousViolations(page), "conta paga, confirmando tirar o pagamento").toEqual([]);
  await page.getByRole("button", { name: "Voltar", exact: true }).click();

  await page.getByRole("link", { name: "Imprimir conta" }).click();
  await expect(page.getByText("Não é documento fiscal")).toBeVisible();
  expect(await seriousViolations(page), "conta impressa").toEqual([]);
  await page.getByRole("link", { name: "Voltar para a conta" }).click();

  await page.getByRole("button", { name: "Fechar conta" }).click();
  await expect(page).toHaveURL(/\/caixa\?fechada=1$/);
  expect(await seriousViolations(page), "/caixa com o aviso de conta fechada").toEqual([]);
  await page.getByRole("link", { name: "Contas fechadas" }).click();
  await expect(page.getByRole("table", { name: "Contas fechadas" })).toBeVisible();
  expect(await seriousViolations(page), "/caixa/contas").toEqual([]);
  await page.goto("/caixa/contas?de=2026-01-01&ate=2026-01-02");
  await expect(page.getByText("Nenhuma conta fechada no período.")).toBeVisible();
  expect(await seriousViolations(page), "/caixa/contas sem contas").toEqual([]);

  await page.goto(tabUrl);
  await expect(page.getByRole("heading", { name: "Mesa 1 · conta fechada" })).toBeVisible();
  await page.getByRole("button", { name: "Reabrir conta" }).click();
  await expect(page.getByLabel("Motivo da reabertura")).toBeVisible();
  expect(await seriousViolations(page), "conta fechada, reabrindo").toEqual([]);
});

test("cardápio com seções e fotos, tela do prato e tela Cardápio sem falhas graves (spec 013)", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const s = seedMenu("board");
  for (const device of ["iPhone 13", "iPad (gen 7)"] as const) {
    const context = await browser.newContext({ ...devices[device], locale: "pt-BR" });
    const cell = await context.newPage();
    await cell.goto(s.qrPath);
    await expect(cell.getByRole("navigation", { name: "Seções do cardápio" })).toBeVisible();
    await expect(cell.locator("main img[data-photo]").first()).toBeVisible();
    expect(await seriousViolations(cell), `cardápio com seções e fotos (${device})`).toEqual([]);
    await cell.getByRole("button", { name: "Pôr X-Burger no carrinho", exact: true }).click();
    await expect(cell.getByRole("region", { name: "X-Burger", exact: true })).toBeVisible();
    expect(await seriousViolations(cell), `tela do prato com foto (${device})`).toEqual([]);
    await cell.getByRole("button", { name: "Voltar ao cardápio" }).click();
    await cell.getByRole("button", { name: "Ver X-Salada" }).click();
    await expect(cell.getByTestId("dish-description")).toBeVisible();
    expect(await seriousViolations(cell), `tela do prato sem foto (${device})`).toEqual([]);
    await context.close();
  }

  await login(page, s.manager, s.password);
  await page.goto("/pedidos/cardapio");
  await expect(page.getByRole("heading", { level: 1, name: "Cardápio" })).toBeVisible();
  expect(await seriousViolations(page), "/pedidos/cardapio").toEqual([]);
  await page.getByRole("link", { name: "X-Burger", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "X-Burger" })).toBeVisible();
  expect(await seriousViolations(page), "produto no cardápio").toEqual([]);
  for (const path of ["/pedidos/cardapio/novo", "/pedidos/cardapio/ver"]) {
    await page.goto(path);
    expect(await seriousViolations(page), path).toEqual([]);
  }
});

test("boas-vindas e cardápio do tablet, Ainda está aí?, Tablet da mesa e Aparência sem falhas graves (spec 016)", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const s = seedMenu("board");
  await login(page, s.manager, s.password);
  await page.goto("/pedidos/cardapio");
  await expect(page.getByRole("region", { name: "Aparência" })).toBeVisible();
  expect(await seriousViolations(page), "quadro Aparência").toEqual([]);

  await page.goto("/pedidos/mesas");
  const box = page.getByRole("region", { name: "Tablet da Mesa 12" });
  await box.getByRole("button", { name: "Criar link do tablet" }).click();
  await expect(box.locator("code")).toHaveText(/\/t\//);
  expect(await seriousViolations(page), "Tablet da mesa").toEqual([]);
  const link = new URL((await box.locator("code").textContent())!).pathname;

  const context = await browser.newContext({ ...devices["Galaxy Tab S4 landscape"], locale: "pt-BR" });
  const tab = await context.newPage();
  await tab.clock.install();
  await tab.goto(link);
  await expect(tab.getByRole("region", { name: "Boas-vindas" })).toBeVisible();
  expect(await seriousViolations(tab), "boas-vindas do tablet").toEqual([]);
  await tab.getByRole("button", { name: "Ver o cardápio" }).click();
  await tab.locator("main").getByRole("button", { name: "Pôr Suco de laranja no carrinho" }).click();
  expect(await seriousViolations(tab), "cardápio do tablet deitado").toEqual([]);
  await tab.clock.fastForward("03:01");
  await expect(tab.getByRole("alertdialog", { name: "Ainda está aí?" })).toBeVisible();
  expect(await seriousViolations(tab), "Ainda está aí?").toEqual([]);
  await context.close();
});

import AxeBuilder from "@axe-core/playwright";
import { devices, expect, test, type Browser, type Page } from "@playwright/test";
import { lastMailTo, PASSWORD, signUp, uniqueEmail } from "./helpers";
import { createTables, newDish, newItem, openCash, qrPath } from "./ordering-helpers";

/** Violações sérias de acessibilidade (WCAG 2.1 AA), como em accessibility.spec.ts. */
async function seriousViolations(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return r.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

/** Convida e aceita a caixa Ana; devolve a página dela, já logada, na tela Caixa. */
async function inviteCashier(page: Page, browser: Browser) {
  await page.goto("/equipe");
  const invite = page.getByRole("form", { name: "Convidar pessoa" });
  const email = uniqueEmail("ana");
  await invite.getByLabel("E-mail").fill(email);
  await invite.getByLabel("Chef").uncheck();
  await invite.getByLabel("Caixa", { exact: true }).check();
  await invite.getByRole("button", { name: "Enviar convite" }).click();
  await expect(invite.getByText("Convite enviado.")).toBeVisible();
  const link = /https?:\/\/\S+\/convite\/\S+/.exec((await lastMailTo(email)).text)?.[0];
  const context = await browser.newContext({ locale: "pt-BR" });
  const ana = await context.newPage();
  await ana.goto(new URL(link!).pathname);
  await ana.getByLabel("Seu nome").fill("Ana");
  await ana.getByLabel("Senha").fill(PASSWORD);
  await ana.getByRole("button", { name: "Aceitar convite" }).click();
  await expect(ana).toHaveURL(/\/caixa$/);
  return { ana, context };
}

/** Roteiro do quickstart da spec 014: abrir, receber, sangria e reforço, contar, fechar e Vendas. */
test("caixa do dia: abrir com troco, sangria, reforço, contar sem ver o esperado, fechar e Vendas (spec 014)", async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000);
  await signUp(page, `Restaurante Caixa ${Date.now()}`);
  await newItem(page, "Carne", "kg");
  await newItem(page, "Laranja", "kg");
  await newDish(page, "X-Burger", [{ component: "Carne (kg)", quantity: "150", unit: "g" }], "30,00");
  await newDish(page, "Suco", [{ component: "Laranja (kg)", quantity: "300", unit: "g" }], "9,00");
  await createTables(page, 12, 12);
  const table12 = await qrPath(page, "12");

  // 1. Ana vê o caixa fechado; Turnos aparece no menu dela, Vendas não.
  const { ana, context } = await inviteCashier(page, browser);
  const bar = ana.getByRole("region", { name: "Situação do caixa" });
  await expect(bar.getByText("Caixa fechado")).toBeVisible();
  await expect(ana.getByRole("navigation", { name: "Menu principal" }).getByRole("link")).toHaveText([
    "Lançar pedido",
    "Caixa",
    "Contas",
    "Turnos",
    "Pedidos",
  ]);
  expect(await seriousViolations(ana), "/caixa com o caixa fechado").toEqual([]);

  // 2. Abrir com R$ 150,00.
  await openCash(ana, "150,00");
  await expect(bar.getByText(/^Caixa aberto desde \d{2}:\d{2} · Ana$/)).toBeVisible();
  for (const name of ["Sangria", "Reforço"]) await expect(bar.getByRole("button", { name })).toBeVisible();
  await expect(bar.getByRole("link", { name: "Fechar caixa" })).toBeVisible();

  // 4 a 6. Celular pede X-Burger e Suco (sem opções: entram direto no pedido) (R$ 39,00 + 10% = R$ 42,90); cozinha e garçom entregam.
  const phoneContext = await browser.newContext({ ...devices["Pixel 7"], locale: "pt-BR" });
  const cell = await phoneContext.newPage();
  await cell.goto(table12);
  await cell.getByRole("button", { name: "Pôr X-Burger no carrinho" }).click();
  await cell.getByRole("button", { name: "Pôr Suco no carrinho" }).click();
  await cell.getByRole("button", { name: /^Ver pedido/ }).click();
  await cell.getByRole("button", { name: "Enviar pedido" }).click();
  await cell
    .getByRole("dialog", { name: "Confira o pedido" })
    .getByRole("button", { name: "Confirmar" })
    .click();
  await expect(cell.getByRole("status").filter({ hasText: "Pedido enviado para a cozinha" })).toBeVisible();
  const kitchen = await page.context().newPage();
  await kitchen.goto("/pedidos/cozinha");
  const ticket = kitchen.getByRole("article", { name: "Pedido 1, Mesa 12" });
  await ticket.getByRole("button", { name: "Começar preparo" }).click();
  await expect(
    kitchen.getByRole("region", { name: "Em preparo" }).getByRole("article", { name: "Pedido 1, Mesa 12" }),
  ).toBeVisible({ timeout: 10_000 });
  await ticket.getByRole("button", { name: "Pronto" }).click();
  await expect(
    kitchen.getByRole("region", { name: "Prontos" }).getByRole("article", { name: "Pedido 1, Mesa 12" }),
  ).toBeVisible({ timeout: 10_000 });
  await page.goto("/pedidos/garcom");
  await page
    .getByRole("article", { name: "Mesa 12, pedido 1" })
    .getByRole("button", { name: "Entregue" })
    .click();
  await expect(page.getByText("Nenhum pedido pronto para levar.")).toBeVisible();

  // 5. Ana recebe em dinheiro (recebido R$ 50,00) e fecha a conta.
  await ana.goto("/caixa");
  await ana.getByRole("link", { name: /Mesa 12/ }).click();
  const pay = ana.getByRole("form", { name: "Lançar pagamento" });
  await pay.getByRole("radio", { name: "Dinheiro" }).check();
  await pay.getByLabel("Recebido em dinheiro (R$)").fill("50,00");
  await expect(pay.getByText("Troco: R$ 7,10")).toBeVisible();
  await pay.getByRole("button", { name: "Lançar pagamento" }).click();
  await ana.getByRole("button", { name: "Fechar conta" }).click();
  await expect(ana).toHaveURL(/\/caixa\?fechada=12$/);

  // 7. Sangria de R$ 150,00 (Cofre) com comprovante.
  await bar.getByRole("button", { name: "Sangria" }).click();
  const entry = bar.getByRole("form", { name: "Registrar sangria" });
  await entry.getByLabel("Valor (R$)").fill("150,00");
  await entry.getByRole("radio", { name: "Cofre" }).check();
  await entry.getByRole("button", { name: "Registrar sangria" }).click();
  await expect(entry.getByText("Sangria registrada.")).toBeVisible();
  expect(await seriousViolations(ana), "/caixa com a sangria").toEqual([]);
  const receipt = await entry.getByRole("link", { name: "Imprimir comprovante" }).getAttribute("href");

  // 8. Sangria acima do esperado (R$ 150,00 + R$ 42,90 − R$ 150,00 = R$ 42,90).
  await entry.getByLabel("Valor (R$)").fill("100,00");
  await entry.getByRole("radio", { name: "Cofre" }).check();
  await entry.getByRole("button", { name: "Registrar sangria" }).click();
  await expect(entry.getByText("A gaveta deve ter R$ 42,90. A sangria não pode passar disso.")).toBeVisible();

  // 9. Reforço de R$ 50,00: esperado R$ 92,90.
  await bar.getByRole("button", { name: "Reforço" }).click();
  const supply = bar.getByRole("form", { name: "Registrar reforço" });
  await supply.getByLabel("Valor (R$)").fill("50,00");
  await supply.getByRole("button", { name: "Registrar reforço" }).click();
  await expect(supply.getByText("Reforço registrado.")).toBeVisible();

  // 10. O gerente vê o esperado; Ana não.
  await page.goto("/caixa");
  await expect(page.getByText("Dinheiro esperado na gaveta: R$ 92,90")).toBeVisible();
  await ana.reload();
  await expect(ana.getByText(/esperado/i)).toHaveCount(0);

  await ana.goto(receipt!);
  await expect(ana.getByRole("article", { name: "Comprovante de sangria" })).toContainText("Assinatura");
  expect(await seriousViolations(ana), "comprovante de sangria").toEqual([]);

  // 11. Fechar caixa: a calculadora soma 1 × R$ 50 + 2 × R$ 20 = R$ 90,00; sem esperado na tela.
  await ana.goto("/caixa/fechar");
  await expect(ana.getByText(/esperad[oa] na gaveta/i)).toHaveCount(0);
  expect(await seriousViolations(ana), "/caixa/fechar (contagem)").toEqual([]);
  await ana.getByLabel("Quantas de R$ 50", { exact: true }).fill("1");
  await ana.getByLabel("Quantas de R$ 20", { exact: true }).fill("2");
  await expect(ana.getByLabel("Dinheiro contado na gaveta (R$)")).toHaveValue("90,00");
  await ana.getByRole("button", { name: "Confirmar contagem" }).click();
  await expect(ana.getByText("Falta R$ 2,90")).toBeVisible();
  expect(await seriousViolations(ana), "/caixa/fechar (resultado)").toEqual([]);

  // 12. Entrou um reforço depois da contagem: o fechamento pede outra contagem.
  const other = await context.newPage();
  await other.goto("/caixa");
  const otherBar = other.getByRole("region", { name: "Situação do caixa" });
  await otherBar.getByRole("button", { name: "Reforço" }).click();
  await otherBar.getByLabel("Valor (R$)").fill("10,00");
  await otherBar.getByRole("button", { name: "Registrar reforço" }).click();
  await expect(otherBar.getByText("Reforço registrado.")).toBeVisible();
  await ana.getByLabel(/^Observação/).fill("Troco errado na mesa 12");
  await ana.getByRole("button", { name: "Fechar caixa" }).click();
  await expect(ana.getByText("Entrou dinheiro no turno depois da contagem. Conte de novo.")).toBeVisible();

  // 13. A tela já volta à contagem. Conta de novo (R$ 100,00), fica R$ 80,00 na gaveta e fecha.
  await ana.getByLabel("Dinheiro contado na gaveta (R$)").fill("100,00");
  await ana.getByRole("button", { name: "Confirmar contagem" }).click();
  await expect(ana.getByText("Falta R$ 2,90")).toBeVisible();
  await ana.getByLabel("Fica na gaveta (R$)").fill("80,00");
  await expect(ana.getByText("Retirada do fechamento: R$ 20,00")).toBeVisible();
  await ana.getByLabel(/^Observação/).fill("Troco errado na mesa 12");
  await ana.getByRole("button", { name: "Fechar caixa" }).click();
  await expect(ana).toHaveURL(/\/caixa\/turnos\/[\w-]+\?fechado=1$/);
  await expect(ana.getByText("1ª contagem R$ 90,00 · 2ª contagem R$ 100,00")).toBeVisible();
  const cash = ana.getByRole("table", { name: "Conta do dinheiro" });
  await expect(cash.getByRole("row", { name: /Esperado na gaveta/ })).toContainText("R$ 102,90");
  await expect(cash.getByRole("row", { name: /Diferença/ })).toContainText("Falta R$ 2,90");
  expect(await seriousViolations(ana), "relatório do turno").toEqual([]);

  // Turnos: o turno fechado com o selo.
  await ana.goto("/caixa/turnos");
  await expect(ana.getByText("Falta R$ 2,90")).toBeVisible();
  expect(await seriousViolations(ana), "/caixa/turnos").toEqual([]);

  // 14. Abrir de novo: o troco vem com o que ficou; outro valor pede observação.
  await ana.goto("/caixa");
  await bar.getByRole("button", { name: "Abrir caixa" }).click();
  await expect(bar.getByLabel("Troco inicial (R$)")).toHaveValue("80,00");
  await bar.getByLabel("Troco inicial (R$)").fill("70,00");
  await expect(bar.getByLabel("Por que o troco é outro?")).toBeVisible();

  // 16 e 17. Vendas do dia e a planilha.
  await page.goto("/vendas");
  const products = page.getByRole("table", { name: "Vendas por produto" });
  await expect(products.getByRole("row", { name: /X-Burger/ })).toContainText("R$ 30,00");
  await expect(products.getByRole("row", { name: /Suco/ })).toContainText("R$ 9,00");
  await expect(page.getByRole("table", { name: "Recebido por forma de pagamento" })).toContainText(
    "R$ 42,90",
  );
  expect(await seriousViolations(page), "/vendas").toEqual([]);
  const csv = await page.request.get(
    (await page.getByRole("link", { name: "Baixar planilha" }).getAttribute("href"))!,
  );
  expect(csv.headers()["content-type"]).toBe("text/csv; charset=utf-8");
  expect(await csv.text()).toContain("X-Burger;1;30,00;");

  // 18. Ana não vê Vendas.
  await ana.goto("/vendas");
  await expect(ana.getByRole("heading", { name: "Sem acesso" })).toBeVisible();

  await phoneContext.close();
  await context.close();
});

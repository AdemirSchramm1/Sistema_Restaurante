import { devices, expect, test, type Page } from "@playwright/test";
import { lastMailTo, PASSWORD, signUp, uniqueEmail } from "./helpers";
import { createTables, customize, newAddon, newDish, newItem, qrPath } from "./ordering-helpers";

const phone = devices["Pixel 7"];

/** Compra pela tela de Lançamentos. */
async function purchase(page: Page, item: string, quantity: string, total: string) {
  await page.goto("/estoque/lancamentos");
  const form = page.getByRole("form", { name: "Lançamento", exact: true });
  await form.getByLabel("Item").selectOption({ label: item });
  await form.getByLabel("Quantidade").fill(quantity);
  await form.getByLabel("Valor total pago (R$)").fill(total);
  await form.getByRole("button", { name: "Lançar" }).click();
  await expect(form.getByText("Lançamento registrado.")).toBeVisible();
}

/** Convida e aceita um caixa; devolve a página dele, já logado. */
async function inviteCashier(page: Page, browser: import("@playwright/test").Browser) {
  await page.goto("/equipe");
  const invite = page.getByRole("form", { name: "Convidar pessoa" });
  const email = uniqueEmail("caixa");
  await invite.getByLabel("E-mail").fill(email);
  await invite.getByLabel("Chef").uncheck();
  await invite.getByLabel("Caixa", { exact: true }).check();
  await invite.getByRole("button", { name: "Enviar convite" }).click();
  await expect(invite.getByText("Convite enviado.")).toBeVisible();
  const link = /https?:\/\/\S+\/convite\/\S+/.exec((await lastMailTo(email)).text)?.[0];
  expect(link).toBeTruthy();
  const context = await browser.newContext({ locale: "pt-BR" });
  const cashier = await context.newPage();
  await cashier.goto(new URL(link!).pathname);
  await cashier.getByLabel("Seu nome").fill("Caixa Carla");
  await cashier.getByLabel("Senha").fill(PASSWORD);
  await cashier.getByRole("button", { name: "Aceitar convite" }).click();
  await expect(cashier).toHaveURL(/\/caixa$/);
  return { cashier, context };
}

/** Roteiro do quickstart da spec 011: celular, cozinha, garçom e caixa em janelas separadas. */
test("do pedido à conta fechada: divisão, troco, mesa livre, contas e baixa do estoque (spec 011)", async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000);
  const restaurant = `Restaurante Conta ${Date.now()}`;
  await signUp(page, restaurant);

  // Cadastro: X-Burger R$ 28,00 (+ queijo R$ 3,00, sem cebola) e Suco R$ 9,00; 1 kg de queijo a R$ 50,00.
  await newItem(page, "Pão", "un");
  await newItem(page, "Carne", "kg");
  await newItem(page, "Queijo", "kg");
  await newItem(page, "Cebola", "kg");
  await newItem(page, "Laranja", "kg");
  await purchase(page, "Queijo (kg)", "1", "50,00");
  const burger = await newDish(
    page,
    "X-Burger",
    [
      { component: "Pão (un)", quantity: "1", unit: "un" },
      { component: "Carne (kg)", quantity: "150", unit: "g" },
      { component: "Queijo (kg)", quantity: "30", unit: "g" },
      { component: "Cebola (kg)", quantity: "20", unit: "g" },
    ],
    "28,00",
  );
  await newDish(page, "Suco", [{ component: "Laranja (kg)", quantity: "300", unit: "g" }], "9,00");
  await newAddon(page, {
    name: "Fatia de queijo",
    component: "Queijo",
    quantity: "20",
    unit: "g",
    price: "3,00",
  });
  await customize(page, burger, {
    addons: [{ label: "Fatia de queijo · R$ 3,00", name: "Fatia de queijo", maxTimes: 3 }],
    removals: ["Cebola"],
  });
  await createTables(page, 12, 12);
  const table12 = await qrPath(page, "12");

  // Caixa convidado: entra direto no Caixa e só vê Caixa, Contas e Pedidos.
  const { cashier, context: cashierContext } = await inviteCashier(page, browser);
  const nav = cashier.getByRole("navigation", { name: "Menu principal" });
  await expect(nav.getByRole("link")).toHaveText(["Caixa", "Contas", "Pedidos"]);
  await expect(cashier.getByText("Nenhuma mesa com conta aberta.")).toBeVisible();

  // Celular: 2 × X-Burger com + 2 Fatia de queijo e sem cebola.
  const phoneContext = await browser.newContext({ ...phone, locale: "pt-BR" });
  const cell = await phoneContext.newPage();
  await cell.goto(table12);
  await cell.getByRole("button", { name: "Adicionar X-Burger" }).click();
  const dish = cell.getByRole("region", { name: "X-Burger" });
  await dish.getByRole("button", { name: "Mais Fatia de queijo" }).click();
  await dish.getByRole("button", { name: "Mais Fatia de queijo" }).click();
  await dish.getByRole("button", { name: "Sem cebola" }).click();
  await dish.getByRole("button", { name: "Mais um prato" }).click();
  await dish.getByRole("button", { name: "Adicionar ao pedido" }).click();
  await cell.getByRole("button", { name: "Enviar pedido" }).click();
  const confirm = cell.getByRole("dialog", { name: "Confira o pedido" });
  await confirm.getByRole("button", { name: "Confirmar" }).click();
  await expect(cell.getByRole("status").filter({ hasText: "Pedido enviado para a cozinha" })).toContainText(
    "Pedido nº 1 · R$ 68,00",
  );

  // O caixa vê a mesa sozinho (atualiza a cada 10 s): total com a taxa e o pedido não entregue.
  const card = cashier.getByRole("link", { name: /Mesa 12/ });
  await expect(card).toContainText("R$ 74,80", { timeout: 15_000 });
  await expect(card).toContainText("1 pedido ainda não foi entregue");

  // Cozinha: "Começar preparo" baixa o estoque (queijo 0,14 kg: 2 × 30 g + 2 × 2 × 20 g).
  const kitchen = await page.context().newPage();
  await kitchen.goto("/pedidos/cozinha");
  const ticket = kitchen.getByRole("article", { name: "Pedido 1, Mesa 12" });
  await ticket.getByRole("button", { name: "Começar preparo" }).click();
  await expect(
    kitchen.getByRole("region", { name: "Em preparo" }).getByRole("article", { name: "Pedido 1, Mesa 12" }),
  ).toBeVisible({ timeout: 10_000 });
  await page.goto("/estoque/itens");
  await page.getByRole("link", { name: "Queijo", exact: true }).click();
  await expect(page.getByTestId("item-balance")).toHaveText("Em estoque: 0,86 kg");
  await page.goto("/estoque/lancamentos");
  await expect(page.getByRole("row").filter({ hasText: "Pedido 1, Mesa 12" })).toHaveCount(3);

  // Celular pede um suco (sem opções: entra direto no pedido); a cozinha cancela ainda recebido,
  // sem perguntar pelos ingredientes.
  await cell.getByRole("button", { name: "Adicionar Suco" }).click();
  await cell.getByRole("button", { name: "Enviar pedido" }).click();
  await confirm.getByRole("button", { name: "Confirmar" }).click();
  await expect(cell.getByRole("status").filter({ hasText: "Pedido enviado para a cozinha" })).toContainText(
    "Pedido nº 2",
  );
  const juice = kitchen.getByRole("article", { name: "Pedido 2, Mesa 12" });
  await expect(juice).toBeVisible({ timeout: 15_000 });
  await juice.getByRole("button", { name: "Cancelar pedido 2" }).click();
  await expect(juice.getByRole("group", { name: "Os ingredientes já foram usados?" })).toHaveCount(0);
  await juice.getByLabel("Motivo").selectOption({ label: "Cliente desistiu" });
  await juice.getByRole("button", { name: "Confirmar cancelamento" }).click();
  await expect(juice).toHaveCount(0, { timeout: 10_000 });

  // Pronto e entregue.
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

  // Caixa abre a conta: suco riscado fora do total; não fecha enquanto falta pagar.
  await card.click();
  await expect(cashier.getByRole("heading", { name: "Mesa 12 · conta aberta" })).toBeVisible();
  const tabUrl = new URL(cashier.url()).pathname;
  await expect(cashier.getByRole("article", { name: "Pedido 2 (cancelado)" })).toContainText(
    "Cancelado: Cliente desistiu",
  );
  const totals = cashier.getByRole("region", { name: "Total da conta" });
  await expect(totals.getByRole("row")).toHaveText([
    "SubtotalR$ 68,00",
    "Serviço 10%R$ 6,80",
    "TotalR$ 74,80",
    "PagoR$ 0,00",
    "FaltaR$ 74,80",
  ]);
  await expect(cashier.getByRole("button", { name: "Fechar conta" })).toBeDisabled();
  await expect(cashier.getByText("Ainda falta pagar R$ 74,80.")).toBeVisible();

  // Dividir por 3: R$ 24,94 + R$ 24,93 + R$ 24,93.
  await cashier.getByText("Dividir a conta").click();
  await cashier.getByLabel("Dividir por quantas pessoas?").fill("3");
  await expect(cashier.getByText("Parte 1 de 3: R$ 24,94")).toBeVisible();
  const pay = cashier.getByRole("form", { name: "Lançar pagamento" });

  await cashier.getByRole("button", { name: "Pagar parte 1 de 3" }).click();
  await expect(pay.getByLabel("Valor (R$)")).toHaveValue("24,94");
  await pay.getByRole("radio", { name: "Cartão de crédito" }).check();
  await pay.getByRole("button", { name: "Lançar pagamento" }).click();
  await expect(totals.getByRole("row").last()).toHaveText("FaltaR$ 49,86");

  await expect(cashier.getByText("Parte 2 de 3: R$ 24,93")).toBeVisible();
  await cashier.getByRole("button", { name: "Pagar parte 2 de 3" }).click();
  await pay.getByRole("radio", { name: "Pix" }).check();
  await pay.getByRole("button", { name: "Lançar pagamento" }).click();
  await expect(totals.getByRole("row").last()).toHaveText("FaltaR$ 24,93");

  // Mais do que falta é recusado com o valor.
  await pay.getByRole("radio", { name: "Pix" }).check();
  await pay.getByLabel("Valor (R$)").fill("30,00");
  await pay.getByRole("button", { name: "Lançar pagamento" }).click();
  await expect(pay.getByText("O valor passa do que falta pagar (R$ 24,93).")).toBeVisible();

  // Parte 3 em dinheiro, recebendo R$ 50,00: troco R$ 25,07.
  await cashier.getByRole("button", { name: "Pagar parte 3 de 3" }).click();
  await pay.getByRole("radio", { name: "Dinheiro" }).check();
  await pay.getByLabel("Recebido em dinheiro (R$)").fill("50,00");
  await expect(pay.getByText("Troco: R$ 25,07")).toBeVisible();
  await pay.getByRole("button", { name: "Lançar pagamento" }).click();
  await expect(totals.getByRole("row").last()).toHaveText("FaltaR$ 0,00");

  // Fechar: a mesa sai do Caixa e o cardápio aberto no celular avisa.
  await cashier.getByRole("button", { name: "Fechar conta" }).click();
  await expect(cashier).toHaveURL(/\/caixa\?fechada=12$/);
  await expect(
    cashier.getByText("Conta da Mesa 12 fechada. A mesa está livre para o próximo cliente."),
  ).toBeVisible();
  await expect(cashier.getByRole("link", { name: /Mesa 12/ })).toHaveCount(0);
  await cell.reload();
  await expect(
    cell
      .getByRole("alert")
      .filter({ hasText: "Esta conta foi fechada. Escaneie o QR code da mesa para pedir de novo." }),
  ).toBeVisible();

  // O próximo cliente escaneia e abre uma conta nova, só com o pedido dele.
  await cell.goto(table12);
  await cell.getByRole("button", { name: "Adicionar Suco" }).click();
  await cell.getByRole("button", { name: "Enviar pedido" }).click();
  await confirm.getByRole("button", { name: "Confirmar" }).click();
  await expect(cell.getByRole("status").filter({ hasText: "Pedido enviado para a cozinha" })).toContainText(
    "Pedido nº 3",
  );
  await expect(cashier.getByRole("link", { name: /Mesa 12/ })).toContainText("R$ 9,90", { timeout: 15_000 });

  // Contas fechadas de hoje: a conta e o resumo por forma de pagamento.
  await cashier
    .getByRole("navigation", { name: "Menu principal" })
    .getByRole("link", { name: "Contas" })
    .click();
  await expect(cashier.getByRole("table", { name: "Contas fechadas" }).getByRole("row").nth(1)).toContainText(
    "R$ 74,80",
  );
  await expect(cashier.getByRole("region", { name: "Resumo do período" }).getByRole("row")).toHaveText([
    "DinheiroR$ 24,93",
    "PixR$ 24,93",
    "Cartão de créditoR$ 24,94",
    "Taxa de serviçoR$ 6,80",
    "Total das contasR$ 74,80",
  ]);

  // Cozinha começa o suco e cancela: "Os ingredientes já foram usados?" Não → a laranja volta.
  const third = kitchen.getByRole("article", { name: "Pedido 3, Mesa 12" });
  await expect(third).toBeVisible({ timeout: 15_000 });
  await third.getByRole("button", { name: "Começar preparo" }).click();
  await expect(
    kitchen.getByRole("region", { name: "Em preparo" }).getByRole("article", { name: "Pedido 3, Mesa 12" }),
  ).toBeVisible({ timeout: 10_000 });
  await third.getByRole("button", { name: "Cancelar pedido 3" }).click();
  const question = third.getByRole("group", { name: "Os ingredientes já foram usados?" });
  await expect(question.getByRole("radio", { name: "Sim, vão para a perda" })).toBeChecked();
  await question.getByRole("radio", { name: "Não, voltam para o estoque" }).check();
  await third.getByLabel("Motivo").selectOption({ label: "Cliente desistiu" });
  await third.getByRole("button", { name: "Confirmar cancelamento" }).click();
  await expect(third).toHaveCount(0, { timeout: 10_000 });
  await page.goto("/estoque/lancamentos");
  await expect(page.getByRole("row").filter({ hasText: "Pedido cancelado · pedido 3, Mesa 12" })).toHaveCount(
    1,
  );

  // O caixa vê a conta fechada, sem "Reabrir conta"; o gerente pede a reabertura, mas a mesa já
  // abriu outra conta (a do pedido 3).
  await cashier.goto(tabUrl);
  await expect(cashier.getByRole("heading", { name: "Mesa 12 · conta fechada" })).toBeVisible();
  await expect(cashier.getByText(/^Fechada às \d{2}:\d{2} por Caixa Carla$/)).toBeVisible();
  await expect(cashier.getByRole("button", { name: "Reabrir conta" })).toHaveCount(0);
  await page.goto(tabUrl);
  await page.getByRole("button", { name: "Reabrir conta" }).click();
  await page.getByLabel("Motivo da reabertura").fill("Cliente pediu a conta em dois CPFs");
  await page.getByRole("button", { name: "Confirmar reabertura" }).click();
  await expect(page.getByText("A mesa já tem outra conta aberta. Feche-a antes.")).toBeVisible();

  // Outro restaurante não vê esta conta.
  const otherContext = await browser.newContext({ locale: "pt-BR" });
  const other = await otherContext.newPage();
  await signUp(other, `Outro Restaurante ${Date.now()}`);
  await other.goto(tabUrl);
  await expect(other.getByRole("heading", { name: "Registro não encontrado" })).toBeVisible();
  await otherContext.close();

  await phoneContext.close();
  await cashierContext.close();
});

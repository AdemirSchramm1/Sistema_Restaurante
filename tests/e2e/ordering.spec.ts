import { devices, expect, test } from "@playwright/test";
import { lastMailTo, PASSWORD, signUp, uniqueEmail } from "./helpers";
import {
  createTables,
  customize,
  expireMenuAccesses,
  newAddon,
  newDish,
  newItem,
  qrPath,
  tableCard,
} from "./ordering-helpers";

const phone = devices["Pixel 7"];

/** Roteiro dos quickstarts das specs 009 e 010: celular, cozinha e garçom em janelas separadas. */
test("do QR code da mesa à entrega, com adicionar e tirar por botão (specs 009 e 010)", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  const restaurant = `Lanchonete QR ${Date.now()}`;
  await signUp(page, restaurant);

  // Cadastro: X-Burger R$ 28,00 com cebola que dá para tirar e queijo extra a R$ 3,00 (até 3 vezes).
  await newItem(page, "Pão", "un");
  await newItem(page, "Carne", "kg");
  await newItem(page, "Queijo mussarela", "kg");
  await newItem(page, "Cebola", "kg");
  const burger = await newDish(
    page,
    "X-Burger",
    [
      { component: "Pão (un)", quantity: "1", unit: "un" },
      { component: "Carne (kg)", quantity: "150", unit: "g" },
      { component: "Queijo mussarela (kg)", quantity: "30", unit: "g" },
      { component: "Cebola (kg)", quantity: "20", unit: "g" },
    ],
    "28,00",
  );
  const cheese = await newAddon(page, {
    name: "Fatia de queijo",
    component: "Queijo mussarela",
    quantity: "20",
    unit: "g",
    price: "3,00",
  });
  await customize(page, burger, {
    addons: [{ label: "Fatia de queijo · R$ 3,00", name: "Fatia de queijo", maxTimes: 3 }],
    removals: ["Cebola"],
  });

  // Mesas 1 a 10; criar a 5 de novo avisa.
  await createTables(page, 1, 10);
  const one = page.getByRole("form", { name: "Criar uma mesa" });
  await one.getByLabel("Nome da mesa").fill("5");
  await one.getByRole("button", { name: "Criar mesa" }).click();
  await expect(one.getByText("Já existe uma mesa com esse nome.")).toBeVisible();
  const table5 = await qrPath(page, "5");

  // Cozinha aberta antes do pedido chegar.
  const kitchen = await page.context().newPage();
  await kitchen.goto("/pedidos/cozinha");
  await expect(kitchen.getByRole("heading", { name: "Cozinha" })).toBeVisible();

  // Celular: escaneia, sem login.
  const phoneContext = await browser.newContext({ ...phone, locale: "pt-BR" });
  const cell = await phoneContext.newPage();
  await cell.goto(table5);
  await expect(cell).toHaveURL(/\/cardapio$/);
  await expect(cell.getByRole("heading", { name: "Mesa 5" })).toBeVisible();
  await expect(cell.getByText(restaurant)).toBeVisible();

  // Tela do prato: só botões; o + para no limite.
  await cell.getByRole("button", { name: "Adicionar X-Burger" }).click();
  const dish = cell.getByRole("region", { name: "X-Burger" });
  await expect(dish.getByRole("textbox")).toHaveCount(0);
  const more = dish.getByRole("button", { name: "Mais Fatia de queijo" });
  await more.click();
  await more.click();
  await more.click();
  await expect(more).toBeDisabled();
  await dish.getByRole("button", { name: "Menos Fatia de queijo" }).click();
  await dish.getByRole("button", { name: "Sem cebola" }).click();
  await expect(dish.getByRole("button", { name: /Sem cebola/ })).toHaveAttribute("aria-pressed", "true");
  await dish.getByRole("button", { name: "Mais um prato" }).click();
  await expect(dish.getByTestId("dish-total")).toHaveText("R$ 68,00");
  await dish.getByRole("button", { name: "Adicionar ao pedido" }).click();
  await expect(cell.getByTestId("cart-total")).toHaveText("R$ 68,00");

  // Envia; dois toques em Confirmar não criam dois pedidos.
  await cell.getByRole("button", { name: "Enviar pedido" }).click();
  const confirm = cell.getByRole("dialog", { name: "Confira o pedido" });
  await expect(confirm).toContainText("2 × X-Burger");
  await expect(confirm).toContainText("+ 2 Fatia de queijo");
  await confirm.getByRole("button", { name: "Confirmar" }).dblclick();
  await expect(cell.getByRole("status").filter({ hasText: "Pedido enviado para a cozinha" })).toContainText(
    "Pedido nº 1 · R$ 68,00",
  );

  // Cozinha recebe sozinha, com as mudanças embaixo do prato.
  const ticket = kitchen.getByRole("article", { name: "Pedido 1, Mesa 5" });
  await expect(ticket).toBeVisible({ timeout: 15_000 });
  await expect(ticket).toContainText("2 × X-Burger");
  await expect(ticket).toContainText("+ 2 Fatia de queijo");
  await expect(ticket).toContainText("SEM cebola");
  await expect(ticket).toContainText("Novo");
  await expect(kitchen.getByRole("article", { name: /^Pedido 2,/ })).toHaveCount(0);
  await ticket.getByRole("button", { name: "Começar preparo" }).click();
  await expect(
    kitchen.getByRole("region", { name: "Em preparo" }).getByRole("article", { name: "Pedido 1, Mesa 5" }),
  ).toBeVisible({ timeout: 10_000 });
  await ticket.getByRole("button", { name: "Pronto" }).click();
  await expect(
    kitchen.getByRole("region", { name: "Prontos" }).getByRole("article", { name: "Pedido 1, Mesa 5" }),
  ).toBeVisible({ timeout: 10_000 });

  // Celular vê a situação em "Meus pedidos".
  const mine = cell.getByRole("region", { name: "Meus pedidos" });
  await expect(mine).toContainText("Pedido nº 1", { timeout: 15_000 });
  await expect(mine).toContainText("Pronto", { timeout: 15_000 });

  // Garçom leva e marca entregue.
  const waiter = await page.context().newPage();
  await waiter.goto("/pedidos/garcom");
  const ready = waiter.getByRole("article", { name: "Mesa 5, pedido 1" });
  await expect(ready).toContainText("SEM cebola");
  await ready.getByRole("button", { name: "Entregue" }).click();
  await expect(waiter.getByText("Nenhum pedido pronto para levar.")).toBeVisible();

  // Preço do adicional muda com o pedido montado: aviso e nova confirmação.
  await cell.getByRole("button", { name: "Adicionar X-Burger" }).click();
  await dish.getByRole("button", { name: "Mais Fatia de queijo" }).click();
  await dish.getByRole("button", { name: "Mais Fatia de queijo" }).click();
  await dish.getByRole("button", { name: "Adicionar ao pedido" }).click();
  await expect(cell.getByTestId("cart-total")).toHaveText("R$ 34,00");
  await page.goto(cheese);
  const addonForm = page.getByRole("form", { name: "Cadastro do adicional" });
  await addonForm.getByLabel("Preço (R$)").fill("3,50");
  await addonForm.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(addonForm.getByText("Alterações salvas.")).toBeVisible();
  await cell.getByRole("button", { name: "Enviar pedido" }).click();
  await confirm.getByRole("button", { name: "Confirmar" }).click();
  await expect(confirm.getByRole("alert")).toContainText("O preço de Fatia de queijo mudou para R$ 3,50.");
  await expect(confirm).toContainText("R$ 35,00");
  await confirm.getByRole("button", { name: "Confirmar" }).click();
  await expect(cell.getByRole("status").filter({ hasText: "Pedido enviado para a cozinha" })).toContainText(
    "Pedido nº 2 · R$ 35,00",
  );
  // O pedido 1 continua com o preço do envio.
  await expect(mine.getByRole("listitem").filter({ hasText: "Pedido nº 1" }).first()).toContainText("R$ 68,00");

  // "Esgotado hoje" na cozinha tira o X-Burger do cardápio.
  await kitchen.getByText(/^Esgotado hoje \(/).click();
  await kitchen.getByRole("form", { name: "Esgotado hoje: X-Burger" }).getByRole("button").click();
  await expect(kitchen.getByRole("form", { name: "Disponível de novo: X-Burger" })).toBeVisible({ timeout: 10_000 });
  await cell.reload();
  await expect(cell.getByRole("heading", { name: "Mesa 5" })).toBeVisible();
  await expect(cell.getByRole("button", { name: "Adicionar X-Burger" })).toHaveCount(0);
  await kitchen.getByRole("form", { name: "Disponível de novo: X-Burger" }).getByRole("button").click();
  await expect(kitchen.getByRole("form", { name: "Esgotado hoje: X-Burger" })).toBeVisible({ timeout: 10_000 });

  // Depois de 20 minutos o acesso acaba; escanear de novo abre outro.
  if (await expireMenuAccesses(restaurant, "5")) {
    await cell.reload();
    await expect(
      cell.getByRole("alert").filter({ hasText: "Seu tempo acabou. Escaneie o QR code da mesa de novo para continuar." }),
    ).toBeVisible();
    await cell.goto(table5);
    await expect(cell.getByRole("button", { name: "Adicionar X-Burger" })).toBeVisible();
    await expect(cell.getByRole("region", { name: "Meus pedidos" })).toHaveCount(0);
  }

  // Trocar o QR code da mesa 5 invalida o impresso.
  await page.goto("/pedidos/mesas");
  const card = tableCard(page, "5");
  await card.getByRole("button", { name: "Trocar QR code" }).click();
  await card.getByRole("button", { name: "Sim, trocar" }).click();
  await expect.poll(() => qrPath(page, "5")).not.toBe(table5);
  await cell.goto(table5);
  await expect(cell.getByText("QR code inválido. Chame um garçom.")).toBeVisible();

  // Chave desligada: ninguém pede pelo QR code.
  const newTable5 = await qrPath(page, "5");
  await page.getByRole("button", { name: "Parar de receber pedidos" }).click();
  await expect(page.getByRole("button", { name: "Voltar a receber pedidos" })).toBeVisible();
  await cell.goto(newTable5);
  await expect(cell.getByText("O restaurante não está recebendo pedidos agora. Chame um garçom.")).toBeVisible();
  await page.getByRole("button", { name: "Voltar a receber pedidos" }).click();
  await expect(page.getByRole("button", { name: "Parar de receber pedidos" })).toBeVisible();

  // Consulta de pedidos do gerente.
  await page.goto("/pedidos");
  const first = page.getByRole("row").filter({ hasText: "R$ 68,00" });
  await expect(first).toContainText("Entregue");
  await first.getByRole("link", { name: "1", exact: true }).click();
  await expect(page.getByText("SEM cebola")).toBeVisible();

  await phoneContext.close();
});

test("garçom só vê Garçom e Pedidos; QR code de outro restaurante abre só o cardápio dele (spec 009)", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const a = `Restaurante A ${Date.now()}`;
  await signUp(page, a);
  await newItem(page, "Arroz", "kg");
  await newDish(page, "Prato da casa", [{ component: "Arroz (kg)", quantity: "200", unit: "g" }], "35,00");

  // Convite de garçom.
  await page.goto("/equipe");
  const invite = page.getByRole("form", { name: "Convidar pessoa" });
  const waiterEmail = uniqueEmail("garcom");
  await invite.getByLabel("E-mail").fill(waiterEmail);
  await invite.getByLabel("Chef").uncheck();
  await invite.getByLabel("Garçom").check();
  await invite.getByRole("button", { name: "Enviar convite" }).click();
  await expect(invite.getByText("Convite enviado.")).toBeVisible();
  const link = /https?:\/\/\S+\/convite\/\S+/.exec((await lastMailTo(waiterEmail)).text)?.[0];
  expect(link).toBeTruthy();

  const waiterContext = await browser.newContext();
  const waiter = await waiterContext.newPage();
  await waiter.goto(new URL(link!).pathname);
  await waiter.getByLabel("Seu nome").fill("Garçom Rui");
  await waiter.getByLabel("Senha").fill(PASSWORD);
  await waiter.getByRole("button", { name: "Aceitar convite" }).click();
  await expect(waiter).toHaveURL(/\/pedidos\/garcom$/);
  const nav = waiter.getByRole("navigation", { name: "Menu principal" });
  await expect(nav.getByRole("link")).toHaveText(["Garçom", "Pedidos"]);
  await waiter.goto("/estoque/itens");
  await expect(waiter.getByRole("heading", { name: "Sem acesso" })).toBeVisible();
  await waiterContext.close();

  // Restaurante B, com a mesa 1.
  const bContext = await browser.newContext();
  const bPage = await bContext.newPage();
  const b = `Restaurante B ${Date.now()}`;
  await signUp(bPage, b);
  await createTables(bPage, 1, 1);
  const bTable = await qrPath(bPage, "1");
  await bContext.close();

  // O gerente do A abre o QR code do B: cardápio do B, nada do A.
  await page.goto(bTable);
  await expect(page.getByText(b)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mesa 1" })).toBeVisible();
  await expect(page.getByText("Prato da casa")).toHaveCount(0);
});

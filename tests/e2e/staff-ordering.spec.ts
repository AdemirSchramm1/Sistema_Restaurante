import { expect, test, type Browser, type Page } from "@playwright/test";
import { lastMailTo, PASSWORD, signUp, uniqueEmail } from "./helpers";
import { createTables, newDish, newItem } from "./ordering-helpers";

/** Convida e aceita o garçom; devolve a página dele, já logada. */
async function inviteWaiter(page: Page, browser: Browser, name: string) {
  await page.goto("/equipe");
  const invite = page.getByRole("form", { name: "Convidar pessoa" });
  const email = uniqueEmail("garcom");
  await invite.getByLabel("E-mail").fill(email);
  await invite.getByLabel("Chef").uncheck();
  await invite.getByLabel("Garçom").check();
  await invite.getByRole("button", { name: "Enviar convite" }).click();
  await expect(invite.getByText("Convite enviado.")).toBeVisible();
  const link = /https?:\/\/\S+\/convite\/\S+/.exec((await lastMailTo(email)).text)?.[0];
  const context = await browser.newContext({ locale: "pt-BR" });
  const waiter = await context.newPage();
  await waiter.goto(new URL(link!).pathname);
  await waiter.getByLabel("Seu nome").fill(name);
  await waiter.getByLabel("Senha").fill(PASSWORD);
  await waiter.getByRole("button", { name: "Aceitar convite" }).click();
  return { waiter, context };
}

const cartBar = (p: Page) => p.getByRole("button", { name: /^Carrinho ·/ });

/** Roteiro do quickstart da spec 015 (passos 1 a 8, 13, 18, 24 e 25). */
test("garçom lança na mesa, a cozinha vê quem lançou, cancela o próprio e a rede caída não lança duas vezes (spec 015)", async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000);
  await signUp(page, `Restaurante Garçom ${Date.now()}`);
  await newItem(page, "Carne", "kg");
  await newItem(page, "Laranja", "kg");
  await newDish(page, "X-Burger", [{ component: "Carne (kg)", quantity: "150", unit: "g" }], "30,00");
  await newDish(page, "Suco", [{ component: "Laranja (kg)", quantity: "300", unit: "g" }], "9,00");
  await createTables(page, 4, 4);
  await createTables(page, 12, 12);

  // 1. João entra direto no Lançar pedido.
  const { waiter: joao, context } = await inviteWaiter(page, browser, "João");
  await expect(joao).toHaveURL(/\/pedidos\/lancar$/);
  const grid = joao.getByRole("list", { name: "Mesas" });
  await expect(grid.getByRole("link", { name: /Mesa 12/ })).toContainText("Livre");

  // 3. Mesa 12, modo Lista, busca: 2 X-Burger em poucos toques.
  await grid.getByRole("link", { name: /Mesa 12/ }).click();
  await expect(joao.getByRole("heading", { name: "Mesa 12", level: 1 })).toBeVisible();
  await joao.getByRole("button", { name: "Lista" }).click();
  await joao.getByLabel("Buscar no cardápio").fill("burg");
  await expect(joao.getByRole("button", { name: "Mais um Suco" })).toHaveCount(0);
  await joao.getByRole("button", { name: "Mais um X-Burger" }).click();
  await joao.getByRole("button", { name: "Mais um X-Burger" }).click();
  await expect(cartBar(joao)).toContainText("2 itens");

  // 5. Trocar mesa: a grade lembra o carrinho; voltar traz ele de volta.
  await joao.getByRole("link", { name: "Trocar mesa" }).click();
  await expect(grid.getByRole("link", { name: /Mesa 12/ })).toContainText("Carrinho: 2 itens");
  await grid.getByRole("link", { name: /Mesa 12/ }).click();
  await expect(cartBar(joao)).toContainText("R$ 60,00");

  // 6 e 7. Conferir e Confirmar: um pedido só.
  await cartBar(joao).click();
  await joao.getByRole("button", { name: "Enviar pedido" }).click();
  const confirm = joao.getByRole("dialog", { name: "Conferir: Mesa 12" });
  await expect(confirm).toContainText("R$ 60,00");
  await confirm.getByRole("button", { name: "Confirmar" }).click();
  await expect(joao.getByText("Pedido 1 enviado para a cozinha")).toBeVisible();
  await expect(cartBar(joao)).toHaveCount(0);

  // 8. A cozinha vê "João" no cartão.
  await page.goto("/pedidos/cozinha");
  await expect(page.getByRole("article", { name: "Pedido 1, Mesa 12" })).toContainText("João");

  // 24 e 25. A resposta do envio não volta (o pedido chegou): trava; Enviar de novo dá o mesmo número.
  await joao.goto("/pedidos/lancar");
  await grid.getByRole("link", { name: /Mesa 4/ }).click();
  await joao.getByRole("button", { name: "Lista" }).click();
  await joao.getByRole("button", { name: "Mais um Suco" }).click();
  await cartBar(joao).click();
  await joao.route(
    "**/pedidos/lancar/**",
    async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fetch();
      await route.abort("connectionreset");
    },
    { times: 1 },
  );
  await joao.getByRole("button", { name: "Enviar pedido" }).click();
  await joao.getByRole("button", { name: "Confirmar" }).click();
  await expect(joao.getByText(/Não deu para saber se o pedido chegou/)).toBeVisible();
  await expect(joao.getByRole("button", { name: "Mais um Suco" })).toBeDisabled();
  await joao.getByRole("button", { name: "Enviar de novo" }).click();
  await expect(joao.getByText("Pedido 2 enviado para a cozinha")).toBeVisible();
  await page.goto("/pedidos/cozinha");
  await expect(page.getByRole("article", { name: /Mesa 4/ })).toHaveCount(1);

  // 13. João cancela o próprio pedido ainda em Recebido: "Lançado errado".
  await joao.getByRole("tab", { name: "Pedidos da mesa" }).click();
  const order2 = joao.getByRole("article", { name: "Pedido 2" });
  await order2.getByRole("button", { name: "Cancelar" }).click();
  await order2.getByLabel("Por que cancelar?").selectOption({ label: "Lançado errado" });
  await order2.getByRole("button", { name: "Cancelar o pedido", exact: true }).click();
  await expect(order2.getByText("Cancelado")).toBeVisible();
  await page.goto("/pedidos/cozinha");
  await expect(page.getByRole("article", { name: /Mesa 4/ })).toHaveCount(0);

  // 18. Consulta: Lançado por João, com o resumo por origem.
  await page.goto("/pedidos");
  await page.getByLabel("Lançado por").selectOption({ label: "João" });
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByRole("table").first().getByRole("row")).toHaveCount(3);
  const summary = page.getByRole("region", { name: "Por quem lançou" });
  await expect(summary).toContainText("João");
  await expect(summary).toContainText("1 Lançado errado");

  await context.close();
});
